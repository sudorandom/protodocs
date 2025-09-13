import React from 'react';

const DetailSection = <T,>({ title, items, renderItem, titleAddon }: { title: string, items: T[], renderItem: (item: T) => React.ReactNode, titleAddon?: React.ReactNode }) => {
    if (!items || items.length === 0) return null;
    return (
        <div className="mt-8">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                {title}
                {titleAddon}
            </h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-6 list-none">
                {items.map(renderItem)}
            </ul>
        </div>
    );
};

export default DetailSection;
