import { Button } from "@/components/ui/button";
import { EPUBParser } from "@/lib/epub/parser";
import { HTMLToBlocksParser } from "@/lib/view/html2block";
import { Paginator, type Page } from "@/lib/view/pagination";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { useState, type ChangeEvent } from "react";
import type { FunctionComponent } from "../common/types";

export const Home = (): FunctionComponent => {
	const [pages, setPages] = useState<Array<Page>>([]);
	const [pageIndex, setPageIndex] = useState<number>(0);

	const leftPage = pages[pageIndex];
	const rightPage = pages[pageIndex + 1];

	const width = 600;
	const height = 800;

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

	return (
		<div className="w-screen h-screen flex flex-col justify-center items-center">
			<h1>Hello World</h1>
			<input
				accept="application/epub+zip"
				id="book"
				name="book"
				type="file"
				onChange={onFileChange}
			/>
			{pageIndex > 0 && (
				<Button
					className="absolute left-0"
					onClick={() => {
						setPageIndex(pageIndex - 2);
					}}
				>
					<ArrowLeftIcon />
				</Button>
			)}
			{pageIndex < pages.length - 1 && (
				<Button
					className="absolute right-0"
					onClick={() => {
						setPageIndex(pageIndex + 2);
					}}
				>
					<ArrowRightIcon />
				</Button>
			)}
			<div className="flex gap-8">
				<article
					dangerouslySetInnerHTML={{ __html: leftPage?.render() ?? "" }}
					className="prose-2xl w-[600px] h-[800px] text-justify font-serif"
				/>
				<article
					dangerouslySetInnerHTML={{ __html: rightPage?.render() ?? "" }}
					className="prose-2xl w-[600px] h-[800px] text-justify font-serif"
				/>
			</div>
		</div>
	);
};
