import React from 'react';
import { Link } from 'react-router-dom';
import { Message, Service, Enum, Extension } from '../types';

interface NavSectionProps {
    title: string;
    items: (Message | Service | Enum | Extension)[];
    selectedItem: Message | Service | Enum | Extension | null;
    selectedItemType: string | null;
    itemType: string;
    packageName: string;
    isExpanded: boolean;
    onToggle: () => void;
}

const NavSection = ({ title, items, selectedItem, selectedItemType, itemType, packageName, isExpanded, onToggle }: NavSectionProps) => {
    if (!items || items.length === 0) return null;
    const isItemSelected = items.some(item => selectedItem && selectedItem.name === item.name && itemType === selectedItemType);

    return (
        <div className="w-full">
            <button onClick={onToggle} className="flex items-center justify-between w-full py-2 px-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none rounded-lg">
                <div className="flex items-center">
                    <span>{title}</span>
                    <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">({items.length})</span>
                </div>
                <svg className={`h-5 w-5 transform transition-transform duration-200 ${!isExpanded && !isItemSelected ? 'rotate-0' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </button>
            <div className={`transition-max-h duration-300 ease-in-out overflow-hidden ${!isExpanded ? 'max-h-0' : 'max-h-screen'}`}>
                <ul className="space-y-1 mt-2">
                    {items.map(item => (
                        <li key={item.name}>
                            <Link to={`/package/${packageName}/${itemType}/${item.name}`} className={`w-full text-left py-2 px-6 text-sm rounded-lg transition-colors duration-200 block ${ selectedItem && selectedItem.name === item.name ? 'bg-blue-600 text-white font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800' }`}>
                                {item.name}
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default NavSection;
