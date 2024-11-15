import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EPUBParser } from "@/lib/epub/parser";
import { HTMLToBlocksParser } from "@/lib/view/html2block";
import { Paginator, type Page } from "@/lib/view/pagination";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";
import type { FunctionComponent } from "../common/types";

export const Home = (): FunctionComponent => {
	const [pages, setPages] = useState<Array<Page>>([]);
	const [pageIndex, setPageIndex] = useState<number>(0);

	const leftPage = pages[pageIndex];
	const rightPage = pages[pageIndex + 1];

	const width = 600;
	const height = 720;

	const onFileChange = async (
		event: ChangeEvent<HTMLInputElement>
	): Promise<void> => {
		const file = event.target.files?.[0];
		if (!file) {
			return;
		}

		console.log(file);

		const arrayBuffer = await file.arrayBuffer();
		const parser: EPUBParser = await EPUBParser.createParser(arrayBuffer);
		const chapterContent = await parser.getChapterContent("s04");
		const blocks = new HTMLToBlocksParser().parse(chapterContent.html);
		const pages = new Paginator(
			{
				width,
				height,
			},
			{
				fontSize: 24,
				lineHeight: 1.5,
			}
		).calculatePages(blocks);
		setPages(pages);
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

	return (
		<div className="w-screen h-screen flex flex-col justify-start items-center pt-16">
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
					className="prose-2xl w-[600px] h-[720px] text-justify font-serif"
				/>
				<article
					dangerouslySetInnerHTML={{ __html: rightPage?.render() ?? "" }}
					className="prose-2xl w-[600px] h-[720px] text-justify font-serif"
				/>
			</div>

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
