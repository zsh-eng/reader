export interface SQLiteConfig {
	version: {
		libVersion: string;
		sourceId: string;
	};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface SQLiteResponse<T = any> {
	result: T;
	dbId?: number;
}

export type SQLiteError = {
	result: {
		message: string;
	};
};

export interface QueryResult {
	columns?: Array<string>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	rows?: Array<Array<any>>;
	rowsAffected?: number;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	values?: Array<any>;
}

export type SQLitePromiser = (
	operation: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	parameters: Record<string, any>
) => Promise<SQLiteResponse>;

export interface WorkerMessage {
	type:
		| "init"
		| "query"
		| "init-success"
		| "init-error"
		| "query-success"
		| "query-error";
	sql?: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	parameters?: Record<string, any>;
	error?: string;
	result?: QueryResult;
	version?: string;
	dbId?: number;
	id?: string;
}

export interface DataQueryResult<T> {
	rows: Array<Array<T>>;
	columnNames: Array<string>;
}
