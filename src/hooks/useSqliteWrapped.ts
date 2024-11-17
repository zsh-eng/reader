import {
	sqlite3Worker1Promiser,
	type Sqlite3Static,
} from "@sqlite.org/sqlite-wasm";
import { useCallback, useEffect, useState } from "react";
import type {
	DataQueryResult,
	QueryResult,
	SQLitePromiser,
} from "../lib/sqlite/sqlite.types";

// There are no types for the worker yet.
declare module "@sqlite.org/sqlite-wasm" {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export function sqlite3Worker1Promiser(...args: any): any;
}

interface UseSQLiteWrappedReturn {
	isInitialized: boolean;
	error: string | null;
	version: string | null;
	executeQuery: (
		sql: string,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		parameters?: Record<string, any>
	) => Promise<QueryResult>;
	getRows: <T>(
		sql: string,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		parameters?: Record<string, any>
	) => Promise<DataQueryResult<T>>;
}

interface UseSQLiteWrappedProps {
	/**
	 * The name of the database file.
	 *
	 * @default "mydb"
	 */
	dbName?: string;
}

/**
 * A hook that wraps the SQLite WASM module and provides a promise-based interface.
 * 
 * SQLite WASM is used through a wrapped worker.
 * For more information:
 * - [SQLite WASM GitHub](https://github.com/sqlite/sqlite-wasm?tab=readme-ov-file)
 * - [Promiser API](https://sqlite.org/wasm/doc/trunk/api-worker1.md#promiser)
 * - [Exec interface for SQL](https://sqlite.org/wasm/doc/trunk/api-oo1.md)
 *
 * @returns An object containing the SQLite instance's state and methods.
 */
export const useSQLiteWrapped = (
	options: UseSQLiteWrappedProps = {}
): UseSQLiteWrappedReturn => {
	const { dbName = "mydb" } = options;

	const [dbId, setDbId] = useState<number | null>(null);
	const [promiser, setPromiser] = useState<SQLitePromiser | null>(null);
	const [isInitialized, setIsInitialized] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [version, setVersion] = useState<string | null>(null);

	useEffect(() => {
		const initSQLite = async (): Promise<void> => {
			try {
				const sqlitePromiser = await new Promise<SQLitePromiser>((resolve) => {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					const _promiser = sqlite3Worker1Promiser({
						onready: () => {
							// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
							resolve(_promiser);
						},
					});
				});

				const configResponse = await sqlitePromiser("config-get", {});
				const openResponse = await sqlitePromiser("open", {
					filename: `file:${dbName}.sqlite3?vfs=opfs`,
				});

				// Only set initialized if we have both a promiser and a dbId
				if (!openResponse.dbId) {
					throw new Error("Failed to get database ID");
				}

				// We don't want React to treat sqlitePromiser as an updater function
				setPromiser(() => sqlitePromiser);
				setVersion((configResponse.result as Sqlite3Static).version.libVersion);
				setDbId(openResponse.dbId);
				setIsInitialized(true);
			} catch (error_) {
				const error = error_ as Error | { result: { message: string } };
				setError("message" in error ? error.message : error.result.message);
			}
		};

		void initSQLite();
	}, []);

	const executeQuery = useCallback(
		async (
			sql: string,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			parameters: Record<string, any> = {}
		): Promise<QueryResult> => {
			if (!promiser || !isInitialized || !dbId) {
				console.error("SQLite is not initialized");
				throw new Error("SQLite is not initialized");
			}

			try {
				const response = await promiser("exec", {
					sql,
					bind: parameters,
					dbId,
				});
				return response.result as QueryResult;
			} catch (error_) {
				const error = error_ as Error | { result: { message: string } };
				throw new Error(
					"message" in error ? error.message : error.result.message
				);
			}
		},
		[promiser, isInitialized, dbId]
	);

	const getRows = useCallback(
		async <T>(
			sql: string,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			parameters: Record<string, any> = {}
		): Promise<DataQueryResult<T>> => {
			if (!promiser || !isInitialized || !dbId) {
				console.error("SQLite is not initialized");
				throw new Error("SQLite is not initialized");
			}

			try {
				const response = (await promiser("exec", {
					sql,
					bind: parameters,
					dbId,
					resultRows: [],
					columnNames: [],
				})) as {
					result: {
						resultRows: Array<Array<T>>;
						columnNames: Array<string>;
					};
				};

				return {
					rows: response.result.resultRows,
					columnNames: response.result.columnNames,
				} as DataQueryResult<T>;
			} catch (error_) {
				const error = error_ as Error | { result: { message: string } };
				throw new Error(
					"message" in error ? error.message : error.result.message
				);
			}
		},
		[promiser, isInitialized, dbId]
	);

	return {
		isInitialized,
		error,
		version,
		executeQuery,
		getRows,
	};
};
