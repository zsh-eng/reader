import type { NavPoint } from "@/lib/epub/parser";

interface TableOfContentsProps {
	navigation: Array<NavPoint>;
	onNavigate?: (source: string) => void;
}

const TableOfContents = ({
	navigation,
	onNavigate,
}: TableOfContentsProps): React.ReactElement => {
	const renderNavPoint = (
		navPoint: NavPoint,
		depth: number = 0
	): React.ReactElement => {
		const hasChildren = navPoint.children.length > 0;

		return (
			<div
				key={navPoint.id}
				className={`w-full`}
				style={{
					paddingLeft: `${depth * 8}px`,
				}}
			>
				<div className="flex items-center w-full">
					<button
						className={`text-left py-2 px-2 hover:underline`}
						onClick={() => onNavigate?.(navPoint.src)}
					>
						<span className="text-lg">{navPoint.label}</span>
					</button>
					<div className="h-px bg-gray-200 flex-grow" />
				</div>

				{hasChildren && (
					<div
						className={`ml-2 border-l-2 border-gray-200 dark:border-gray-700`}
					>
						{navPoint.children.map((child) => renderNavPoint(child, depth + 1))}
					</div>
				)}
			</div>
		);
	};

	return (
		<div className="w-full overflow-y-auto -ml-2">
			<div className="space-y-1">
				{navigation.map((navPoint) => renderNavPoint(navPoint))}
			</div>
		</div>
	);
};

export default TableOfContents;
