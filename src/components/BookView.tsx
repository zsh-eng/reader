import type { BookReader } from "@/lib/reader/book-reader";

import TableOfContents from "@/components/TableOfContents";
import { Button } from "@/components/ui/button";
import type { Page } from "@/lib/view/pagination";
import { ArrowLeftIcon, ArrowRightIcon, BookIcon } from "lucide-react";
import { useEffect, useState } from "react";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);

	let binaryString = "";
	bytes.forEach((byte) => {
		binaryString += String.fromCharCode(byte);
	});

	return btoa(binaryString);
}

export default function BookView({
	reader,
	onNavigateBack,
}: {
	reader: BookReader;
	onNavigateBack: () => void;
}): React.ReactElement {
	const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
	const [pages, setPages] = useState<Array<Page>>([]);
	const [pageIndex, setPageIndex] = useState<number>(0);

	const navigation = reader?.getNavigation();
	const title = reader?.getMetadata()?.title ?? "Books";
	const coverImageData = reader?.getMetadata()?.coverImageData;
	const author = reader?.getMetadata()?.creator ?? "";

	const leftPage = pages[pageIndex];
	const rightPage = pages[pageIndex + 1];

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent): void => {
			if (event.key === "ArrowLeft") {
				setPageIndex(Math.max(0, pageIndex - 2));
			}
			if (event.key === "ArrowRight") {
				setPageIndex(Math.min(pages.length - 1, pageIndex + 2));
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return (): void => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [pageIndex, pages]);

	const BookContent = (): React.ReactElement => {
		return (
			<div className="pt-4">
				{pageIndex > 0 && (
					<Button
						className="absolute left-2 top-1/2 -translate-y-1/2 group hover:bg-transparent"
						variant={"ghost"}
						onClick={() => {
							setPageIndex(pageIndex - 2);
						}}
					>
						<ArrowLeftIcon className="!w-14 !h-14 text-muted-foreground group-hover:text-foreground transition-all" />
					</Button>
				)}
				{pageIndex < pages.length - 1 && (
					<Button
						className="absolute right-2 top-1/2 -translate-y-1/2 group hover:bg-transparent"
						variant={"ghost"}
						onClick={() => {
							setPageIndex(pageIndex + 2);
						}}
					>
						<ArrowRightIcon className="!w-14 !h-14 text-muted-foreground group-hover:text-foreground transition-all" />
					</Button>
				)}
				<div className="flex gap-16">
					<article
						dangerouslySetInnerHTML={{ __html: leftPage?.render() ?? "" }}
						className="prose-2xl w-[600px] h-[720px] text-justify font-serif"
					/>
					<article
						dangerouslySetInnerHTML={{ __html: rightPage?.render() ?? "" }}
						className="prose-2xl w-[600px] h-[720px] text-justify font-serif"
					/>
				</div>
			</div>
		);
	};

	return (
		<div className="w-screen h-screen flex flex-col justify-start items-center pt-4">
			<div className="flex items-center gap-2 mb-10">
				<BookIcon className="w-6 h-6" />
				<h1 className="text-xl font-bold">{title}</h1>
			</div>

			{selectedChapter && <BookContent />}
			{!selectedChapter && navigation && (
				<div className="grid grid-cols-3 max-w-6xl gap-x-12 px-8 pb-16">
					<div className="col-span-1">
						{coverImageData && (
							<img
								alt={title}
								className="w-full shadow-md rounded-xl sticky top-8"
								src={`data:image/png;base64,${arrayBufferToBase64(coverImageData)}`}
							/>
						)}
					</div>
					<div className="col-span-2 flex flex-col gap-4 pt-4">
						<div className="flex flex-col gap-2">
							<h1 className="text-5xl font-bold">{title}</h1>
							<p className="text-2xl text-muted-foreground">{author}</p>
						</div>

						<TableOfContents
							navigation={navigation}
							onNavigate={async (source) => {
								if (!reader) {
									return;
								}

								const { pages, pageIndex } = await reader.navigateToId(source);
								if (pageIndex === -1) {
									console.error("Failed to navigate to ID", source);
									return;
								}

								setPages(pages);
								setPageIndex(pageIndex);
								setSelectedChapter(source);
							}}
						/>
					</div>
				</div>
			)}

			<div className="absolute left-4 top-4">
				<Button
					className="hover:bg-transparent hover:-translate-x-2 transition"
					size={"icon"}
					variant={"ghost"}
					onClick={() => {
						if (selectedChapter) {
							setSelectedChapter(null);
						} else {
							onNavigateBack();
						}
					}}
				>
					<ArrowLeftIcon className="!w-10 !h-10" />
				</Button>
			</div>

			{selectedChapter && (
				<div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm">
					<p className="text-muted-foreground">
						Page {pageIndex / 2 + 1} of {pages.length / 2}
					</p>
				</div>
			)}
		</div>
	);
}
