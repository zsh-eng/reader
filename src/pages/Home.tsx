import BookView from "@/components/BookView";
import LibraryView from "@/components/LibraryView";
import { type Book, useLibrary } from "@/hooks/useLibrary";
import type { BookReader } from "@/lib/reader/book-reader";
import { useState } from "react";
import { toast } from "sonner";
import type { FunctionComponent } from "../common/types";

export const Home = (): FunctionComponent => {
	const [reader, setReader] = useState<BookReader | null>(null);
	const [view, setView] = useState<"library" | "book">("library");

	const onNavigateBack = (): void => {
		setView("library");
	};

	const { books, loading, error, getReader, addBook } = useLibrary();

	if (loading) {
		return <div>Loading...</div>;
	}

	if (error) {
		return <div>Error: {error}</div>;
	}

	const onBookClick = async (book: Book): Promise<void> => {
		const reader = await getReader(book.id, {
			height: 600,
			width: 720,
			fontSize: 24,
			lineHeight: 5 / 3,
		});

		setReader(reader);
		setView("book");
	};

	const onAddBook = async (file: File): Promise<void> => {
		const arrayBuffer = await file.arrayBuffer();
		try {
			await addBook(arrayBuffer);
			toast.success("Book added to library");
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			if (message.includes("UNIQUE constraint failed")) {
				toast.error("Book already exists in library");
			} else {
				toast.error(message);
			}
		}
	};

	return view === "library" || !reader ? (
		<LibraryView
			books={books}
			onAddBook={onAddBook}
			onBookClick={onBookClick}
		/>
	) : (
		<BookView reader={reader} onNavigateBack={onNavigateBack} />
	);
};
