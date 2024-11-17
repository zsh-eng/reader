import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Book } from "@/hooks/useLibrary";
import { PlusIcon, SquareLibrary } from "lucide-react";

function BookCard({
	book,
	onClick,
}: {
	book: Book;
	onClick: () => void;
}): React.ReactElement {
	const { title, author, coverImage } = book;

	return (
		<div className="flex flex-col gap-4 items-center w-60">
			{coverImage && (
				<img
					alt="Cover"
					className="w-56 h-80 object-cover shadow-md rounded-xl cursor-pointer border"
					src={`data:image/jpeg;base64,${btoa(String.fromCharCode(...new Uint8Array(coverImage)))}`}
					onClick={onClick}
				/>
			)}
			<div className="flex flex-col gap-1 items-center w-56 h-18">
				<div className="font-semibold text-base">{title}</div>
				<div className="text-center line-clamp-2 text-sm">{author}</div>
			</div>
		</div>
	);
}

export default function LibraryView({
	onBookClick,
	onAddBook,
	books,
}: {
	onBookClick: (book: Book) => void;
	onAddBook: (file: File) => void;
	books: Array<Book>;
}): React.ReactElement {
	return (
		<div className="w-screen h-screen flex flex-col justify-start items-center pt-4">
			<div className="flex items-center gap-2 mb-10">
				<SquareLibrary className="w-6 h-6" />
				<h1 className="text-xl font-bold">Library</h1>
			</div>

			<div className="flex flex-wrap gap-4">
				{books.map((book) => (
					<BookCard
						key={book.id}
						book={book}
						onClick={() => {
							onBookClick(book);
						}}
					/>
				))}
			</div>

			<div className="absolute right-4 top-4">
				<Input
					accept="application/epub+zip"
					className="hidden"
					id="book"
					name="book"
					type="file"
					onChange={(event) => {
						if (event.target.files?.[0]) {
							onAddBook(event.target.files?.[0]);
						}
					}}
				/>
				<label htmlFor="book">
					<TooltipProvider>
						<Tooltip delayDuration={100}>
							<TooltipTrigger asChild>
								<Button
									size={"icon"}
									type="button"
									variant={"ghost"}
									onClick={() => {
										document.getElementById("book")?.click();
									}}
								>
									<PlusIcon className="!w-10 !h-10 hover:scale-110 transition-all rounded-full cursor-pointer" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								<p>Add a book</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</label>
			</div>
		</div>
	);
}
