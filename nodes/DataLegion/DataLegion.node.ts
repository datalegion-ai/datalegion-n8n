import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
	CLEAN_FIELDS,
	COMPANY_IDENTIFIERS,
	DATA_FIELDS,
	names,
	PERSON_IDENTIFIERS,
	properties,
} from './descriptions';
import { compact, post } from './transport';

type Match = Record<string, IDataObject | undefined> & { match_metadata?: IDataObject };

const IDENTIFIERS = { company: names(COMPANY_IDENTIFIERS), person: names(PERSON_IDENTIFIERS) };

// One POST /<entity>/enrich per item. A 404 is "no match": the item comes out with
// matched: false instead of failing the workflow, so a list keeps every row.
async function enrich(
	this: IExecuteFunctions,
	entity: 'company' | 'person',
	i: number,
): Promise<IDataObject> {
	const identifiers = compact(
		this.getNodeParameter('identifiers', i, {}) as IDataObject,
		IDENTIFIERS[entity],
	);
	if (Object.keys(identifiers).length === 0) {
		throw new NodeOperationError(this.getNode(), `Add at least one ${entity} identifier.`, {
			itemIndex: i,
		});
	}
	const options = compact(this.getNodeParameter('options', i, {}) as IDataObject, [
		'min_confidence',
		'required_fields',
	]);
	const response = await post.call(
		this,
		`/${entity}/enrich`,
		{ ...identifiers, ...options },
		i,
		[404],
	);
	const match =
		response.statusCode === 404 ? undefined : (response.body as { matches?: Match[] }).matches?.[0];
	const record = match?.[entity];
	return record
		? { matched: true, ...record, match_metadata: match.match_metadata }
		: { matched: false };
}

async function utility(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	if (operation === 'hashEmail') {
		const email = (this.getNodeParameter('email', i) as string).trim();
		return (await post.call(this, '/utility/hash/email', { email }, i)).body as IDataObject;
	}
	const fields = compact(
		this.getNodeParameter('fields', i, {}) as IDataObject,
		names(operation === 'clean' ? CLEAN_FIELDS : DATA_FIELDS),
	);
	if (Object.keys(fields).length === 0) {
		throw new NodeOperationError(this.getNode(), 'Add at least one field.', { itemIndex: i });
	}
	if (operation === 'clean') {
		const region = compact({ default_region: this.getNodeParameter('defaultRegion', i, '') }, [
			'default_region',
		]);
		return (await post.call(this, '/utility/clean', { ...region, fields }, i)).body as IDataObject;
	}
	return (await post.call(this, '/utility/validate', fields, i)).body as IDataObject;
}

export class DataLegion implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Data Legion',
		name: 'dataLegion',
		icon: { light: 'file:datalegion.svg', dark: 'file:datalegion.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description:
			'Enrich people and companies, and clean, hash and validate contact data, with Data Legion',
		defaults: { name: 'Data Legion' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'dataLegionApi', required: true }],
		properties,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const json =
					resource === 'utility'
						? await utility.call(this, operation, i)
						: await enrich.call(this, resource as 'company' | 'person', i);
				returnData.push({ json, pairedItem: { item: i } });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				// Ours already carry the API's message and the item; anything else (a network failure)
				// is wrapped so n8n shows it against this node and item.
				throw error instanceof NodeApiError || error instanceof NodeOperationError
					? error
					: new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
