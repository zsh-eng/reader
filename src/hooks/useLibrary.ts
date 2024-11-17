import { EPUBParser } from "@/lib/epub/parser";
import { BookReader, type BookReaderOptions } from "@/lib/reader/book-reader";
import { useEffect, useState } from "react";
import { useSQLiteWrapped } from "./useSqliteWrapped";

/**
 * A book in the library.
 */
export type Book = {
	id: number;
	identifier: string;
	title: string;
	author?: string;
	coverImage?: Uint8Array;
	epubFile: Uint8Array;
	createdAt: string;
	updatedAt: string;
};

export type UseLibraryReturn = {
	loading: boolean;
	error: string | null;
	books: Array<Book>;
	/**
	 * Add a book to the library.
	 *
	 * @param epubArrayBuffer - The EPUB file as an ArrayBuffer.
	 */
	addBook: (epubArrayBuffer: ArrayBuffer) => Promise<void>;
	getReader: (
		bookId: number,
		options: BookReaderOptions
	) => Promise<BookReader>;
};

type PrefixWithDollar<T > = {
	[K in keyof T as `$${string & K}`]: T[K]
};

function bookToQueryParameters<T extends object>(
	book: T
): PrefixWithDollar<T> {
	return Object.fromEntries(
		Object.entries(book).map(([key, value]) => [`$${key}`, value])
	) as PrefixWithDollar<T>;
}

function toBook(row: Array<unknown>): Book {
	return {
		id: row[0] as number,
		identifier: row[1] as string,
		title: row[2] as string,
		author: row[3] as string,
		coverImage: row[4] as Uint8Array | undefined,
		epubFile: row[5] as Uint8Array,
		createdAt: row[6] as string,
		updatedAt: row[7] as string,
	};
}

async function createBookFromEPUB(
	epubArrayBuffer: ArrayBuffer
): Promise<Omit<Book, "id" | "createdAt" | "updatedAt">> {
	const parser = await EPUBParser.createParser(epubArrayBuffer);
	const metadata = parser.getMetadata();

	const imageUint8View = metadata.coverImageData
		? new Uint8Array(metadata.coverImageData)
		: undefined;
	const epubUint8View = new Uint8Array(epubArrayBuffer);

	return {
		identifier: metadata.identifier,
		title: metadata.title,
		author: metadata.creator,
		coverImage: imageUint8View,
		epubFile: epubUint8View,
	};
}

const INIT_SQL = `-- Library table to store basic book information
CREATE TABLE IF NOT EXISTS library (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT NOT NULL UNIQUE,  -- The EPUB's unique identifier from metadata
    title TEXT NOT NULL,
    author TEXT,
    cover_image BLOB,
    epub_file BLOB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups by identifier
CREATE INDEX IF NOT EXISTS idx_library_identifier ON library(identifier);

-- Index for searching/sorting by title
CREATE INDEX IF NOT EXISTS idx_library_title ON library(title);

-- Index for searching/sorting by author
CREATE INDEX IF NOT EXISTS idx_library_author ON library(author);

-- Trigger to update the updated_at timestamp
CREATE TRIGGER IF NOT EXISTS library_updated_at 
AFTER UPDATE ON library
BEGIN
    UPDATE library SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
`;

/**
 * A hook for interacting with the library.
 */
export function useLibrary(): UseLibraryReturn {
	const { isInitialized, executeQuery, getRows } = useSQLiteWrapped();

	const [loading, setLoading] = useState(true);
	const [books, setBooks] = useState<Array<Book>>([]);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!isInitialized) {
			return;
		}

		const initializeLibrary = async (): Promise<void> => {
			try {
				await executeQuery(INIT_SQL);
				const rawBooks = await getRows<Book>("SELECT * FROM library");
				const books = rawBooks.rows.map(toBook);
				setBooks(books);
				setLoading(false);
			} catch (error) {
				setError(error instanceof Error ? error.message : "Unknown error");
				setLoading(false);
			}
		};

		void initializeLibrary();
	}, [isInitialized, executeQuery, getRows]);

	const addBook = async (epubArrayBuffer: ArrayBuffer): Promise<void> => {
		const book = await createBookFromEPUB(epubArrayBuffer);
		const queryParameters = bookToQueryParameters(book);
		await executeQuery(
			`INSERT INTO library (identifier, title, author, cover_image, epub_file) VALUES ($identifier, $title, $author, $coverImage, $epubFile)`,
			queryParameters
		);
		const rawBooks = await getRows<Book>(`SELECT * FROM library`);
		const books = rawBooks.rows.map(toBook);
		setBooks(books);
	};

	const getReader = async (
		bookId: number,
		options: BookReaderOptions
	): Promise<BookReader> => {
		const book = books.find((b) => b.id === bookId);
		if (!book) {
			throw new Error("Book not found");
		}
		const parser = await EPUBParser.createParser(book.epubFile);
		const readerOptions = {
			width: options.width,
			height: options.height,
			fontSize: options.fontSize,
			lineHeight: options.lineHeight,
		};
		return new BookReader(parser, readerOptions);
	};

	return {
		loading,
		error,
		books,
		addBook,
		getReader,
	};
}
