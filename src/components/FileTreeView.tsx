import React from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { ProtoFile } from '../types';
import { getCommonPathPrefix } from '../utils';

const FileTreeView = ({ files, packageName, isExpanded, onToggle }: { files: ProtoFile[], packageName: string, isExpanded: boolean, onToggle: () => void }) => {
    const { fileName } = useParams();
    const isFileActive = files.some(f => f.fileName.replace(/\//g, '+') === fileName);

    const fileNames = files.map(f => f.fileName);
    const commonPrefix = getCommonPathPrefix(fileNames);

    if (!files || files.length === 0) return null;

    return (
        <div className="w-full">
            <button onClick={onToggle} className="flex items-center justify-between w-full py-2 px-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none rounded-lg">
                <div className="flex items-center">
                    <span>Files</span>
                    <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">({files.length})</span>
                </div>
                <svg className={`h-5 w-5 transform transition-transform duration-200 ${!isExpanded && !isFileActive ? 'rotate-0' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </button>
            <div className={`transition-max-h duration-300 ease-in-out overflow-hidden ${!isExpanded ? 'max-h-0' : 'max-h-screen'}`}>
                {commonPrefix && (
                    <div className="px-6 py-1 text-xs text-gray-500 dark:text-gray-400 truncate" title={commonPrefix}>
                        {commonPrefix}
                    </div>
                )}
                <ul className="space-y-1 mt-2 list-none">
                    {files.map(file => (
                        <li key={file.fileName}>
                            <NavLink to={`/package/${packageName}/files/${file.fileName.replace(/\//g, '+')}`} className={({ isActive }) => `w-full text-left py-2 px-6 text-sm rounded-lg transition-colors duration-200 block ${ isActive ? 'bg-blue-600 text-white font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800' }`}>
                                {file.fileName.substring(commonPrefix.length)}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default FileTreeView;
