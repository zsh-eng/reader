import TableOfContents from "@/components/TableOfContents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EPUBParser } from "@/lib/epub/parser";
import { HTMLToBlocksParser } from "@/lib/view/html2block";
import { Paginator, type Page } from "@/lib/view/pagination";
import { ArrowLeftIcon, ArrowRightIcon, BookIcon } from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";
import type { FunctionComponent } from "../common/types";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);

	let binaryString = "";
	bytes.forEach((byte) => {
		binaryString += String.fromCharCode(byte);
	});

	return btoa(binaryString);
}

export const Home = (): FunctionComponent => {
	const [parser, setParser] = useState<EPUBParser | null>(null);
	const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
	const [pages, setPages] = useState<Array<Page>>([]);
	const [pageIndex, setPageIndex] = useState<number>(0);
	const navigation = parser?.getNavigation();
	const title = parser?.getMetadata()?.title ?? "Books";
	const coverImageData = parser?.getMetadata()?.coverImageData;
	const author = parser?.getMetadata()?.creator ?? "";

	const leftPage = pages[pageIndex];
	const rightPage = pages[pageIndex + 1];

	const width = 600;
	const height = 720;

	useEffect(() => {
		if (!selectedChapter || !parser) {
			return;
		}

		const updatePages = async (): Promise<void> => {
			const chapterContent = await parser.getChapterContent(selectedChapter);
			const blocks = new HTMLToBlocksParser().parse(chapterContent);
			const pages = new Paginator(
				{
					width,
					height,
				},
				{
					fontSize: 24,
					lineHeight: 5 / 3,
				}
			).calculatePages(blocks);
			setPages(pages);
		};

		void updatePages();
	}, [selectedChapter, parser]);

	const onFileChange = async (
		event: ChangeEvent<HTMLInputElement>
	): Promise<void> => {
		const file = event.target.files?.[0];
		if (!file) {
			return;
		}

		const arrayBuffer = await file.arrayBuffer();
		const parser: EPUBParser = await EPUBParser.createParser(arrayBuffer);

		setParser(parser);
	};

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
			<div className="pt-16">
				{pageIndex > 0 && (
					<Button
						className="absolute left-4 top-1/2 -translate-y-1/2 w-24 h-24 group"
						variant={"ghost"}
						onClick={() => {
							setPageIndex(pageIndex - 2);
						}}
					>
						<ArrowLeftIcon className="!w-16 !h-16 text-muted-foreground group-hover:text-foreground transition-all" />
					</Button>
				)}
				{pageIndex < pages.length - 1 && (
					<Button
						className="absolute right-4 top-1/2 -translate-y-1/2 w-24 h-24 group"
						variant={"ghost"}
						onClick={() => {
							setPageIndex(pageIndex + 2);
						}}
					>
						<ArrowRightIcon className="!w-16 !h-16 text-muted-foreground group-hover:text-foreground transition-all" />
					</Button>
				)}
				<div className="flex gap-16">
					<article
						dangerouslySetInnerHTML={{ __html: leftPage?.render() ?? "" }}
						className="prose-2xl w-[600px] h-[720px] text-justify font-serif border border-black"
					/>
					<article
						dangerouslySetInnerHTML={{ __html: rightPage?.render() ?? "" }}
						className="prose-2xl w-[600px] h-[720px] text-justify font-serif border border-black"
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
				<div className="grid grid-cols-3 max-w-6xl gap-x-12 px-8">
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
							onNavigate={setSelectedChapter}
						/>
					</div>
				</div>
			)}

			<div className="absolute bottom-4">
				<Input
					accept="application/epub+zip"
					id="book"
					name="book"
					type="file"
					onChange={onFileChange}
				/>
			</div>
		</div>
	);
};
