import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
} from 'n8n-workflow';
import { vi } from 'vitest';

import { DataLegion } from '../nodes/DataLegion/DataLegion.node';

export type Response = { statusCode: number; body: unknown };
export type Request = (options: IHttpRequestOptions) => Promise<Response>;

// A stand-in for n8n's execute context: one input item per entry in `items`, each holding the
// node parameters for that item. `request` plays httpRequestWithAuthentication.
export const run = async (
	items: IDataObject[],
	request: Request,
	{ continueOnFail = false } = {},
): Promise<IDataObject[]> => {
	const context = {
		continueOnFail: () => continueOnFail,
		getInputData: (): INodeExecutionData[] => items.map(() => ({ json: {} })),
		getNode: () => ({
			name: 'Data Legion',
			type: 'n8n-nodes-datalegion.dataLegion',
			typeVersion: 1,
			parameters: {},
		}),
		getNodeParameter: (name: string, i: number, fallback?: unknown) => items[i][name] ?? fallback,
		helpers: {
			httpRequestWithAuthentication: vi.fn((_credential: string, options: IHttpRequestOptions) =>
				request(options),
			),
		},
	} as unknown as IExecuteFunctions;
	const [out] = await new DataLegion().execute.call(context);
	return out.map((item) => ({ ...item.json, _paired: item.pairedItem }));
};

// Calls the production API the way n8n would after applying the credential: the API-Key header,
// a JSON body, and no throw on an error status.
export const liveRequest =
	(apiKey: string): Request =>
	async (options) => {
		const response = await fetch(options.url, {
			method: options.method,
			headers: { 'API-Key': apiKey.trim(), 'Content-Type': 'application/json' },
			body: JSON.stringify(options.body),
		});
		const text = await response.text();
		let body: unknown = text;
		try {
			body = JSON.parse(text);
		} catch {
			// a non-JSON body stays text, as n8n hands it over
		}
		return { statusCode: response.status, body };
	};
