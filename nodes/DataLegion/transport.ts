import type {
	IDataObject,
	IExecuteFunctions,
	IN8nHttpFullResponse,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export const API_URL = 'https://api.datalegion.ai';

type ErrorBody = { detail?: unknown; error?: string; message?: string };

// The API answers {error, message}; FastAPI's own errors wrap theirs in {detail}, a string,
// an {error, message} object, or a list of validation problems ({msg}).
export const errorMessage = (status: number, body: unknown): string => {
	if (typeof body === 'string') {
		// A plain-text body (a proxy or gateway in between, not the API) is the only explanation there is.
		const text = body.trim();
		return text && !text.startsWith('{') && !text.startsWith('<')
			? `HTTP ${status}: ${text.slice(0, 300)}`
			: `Data Legion returned HTTP ${status}.`;
	}
	const { detail, message } = (body ?? {}) as ErrorBody;
	if (message) {
		return message;
	}
	if (typeof detail === 'string') {
		return detail;
	}
	if (Array.isArray(detail)) {
		return detail
			.map((d: { msg?: string }) => d.msg)
			.filter(Boolean)
			.join('; ');
	}
	if (detail && typeof detail === 'object' && 'message' in detail) {
		return String((detail as { message: unknown }).message);
	}
	return `Data Legion returned HTTP ${status}.`;
};

const HINTS: Record<number, string> = {
	401: 'Check the API key in the Data Legion credential.',
	402: 'The account is out of credits for this endpoint. Add credits in the Data Legion dashboard.',
	403: 'This API key is not allowed to call this endpoint. Check its scopes in the Data Legion dashboard.',
	429: 'Rate limited. Turn on Retry On Fail in the node settings, or slow the workflow down.',
};

// POSTs to the API and returns the full response; the caller decides what a non-2xx means
// (enrich treats 404 as "no match"). Any other status at or above 400 becomes a NodeApiError
// whose message is the API's own explanation.
export async function post(
	this: IExecuteFunctions,
	path: string,
	body: IDataObject,
	itemIndex: number,
	allowStatus: number[] = [],
): Promise<IN8nHttpFullResponse> {
	const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'dataLegionApi', {
		method: 'POST',
		url: `${API_URL}${path}`,
		body,
		json: true,
		ignoreHttpStatusErrors: true,
		returnFullResponse: true,
	})) as IN8nHttpFullResponse;
	const status = response.statusCode;
	if (status >= 400 && !allowStatus.includes(status)) {
		const message = errorMessage(status, response.body);
		throw new NodeApiError(this.getNode(), (response.body ?? {}) as JsonObject, {
			message,
			description: HINTS[status],
			httpCode: String(status),
			itemIndex,
		});
	}
	return response;
}

// Drops empty inputs so the API sees only what the user filled in; a blank optional field
// would otherwise count as an identifier.
export const compact = (values: IDataObject, keys: readonly string[]): IDataObject =>
	Object.fromEntries(
		keys
			.map((key) => [
				key,
				typeof values[key] === 'string' ? (values[key] as string).trim() : values[key],
			])
			.filter(([, value]) => value !== undefined && value !== null && value !== ''),
	);
