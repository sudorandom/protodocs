import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

const ExpandableMarkdown = ({ description }: { description: string }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const lines = description.split('\n');
    const isLong = lines.length > 5;

    return (
        <div className="prose dark:prose-invert max-w-none mt-2">
            <ReactMarkdown>
                {isLong && !isExpanded ? lines.slice(0, 5).join('\n') : description}
            </ReactMarkdown>
            {isLong && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline ml-1"
                >
                    {isExpanded ? 'View less' : 'View more'}
                </button>
            )}
        </div>
    );
};

export default ExpandableMarkdown;
