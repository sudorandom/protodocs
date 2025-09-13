import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { type ProtoPackage } from '../types';

const PackageNav = ({ packages }: { packages: ProtoPackage[] }) => {
    const { packageName } = useParams();
    const navigate = useNavigate();
    const [isPackageDropdownOpen, setIsPackageDropdownOpen] = useState(false);
    const [packageFilter, setPackageFilter] = useState('');
    const [selectedPackageIndex, setSelectedPackageIndex] = useState(0);
    const packageFilterInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isPackageDropdownOpen) {
          packageFilterInputRef.current?.focus();
        }
    }, [isPackageDropdownOpen]);

    const filteredPackages = packages.filter((p) =>
        p.name.toLowerCase().includes(packageFilter.toLowerCase())
    );

    const handlePackageFilterKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedPackageIndex((prevIndex) =>
            Math.min(prevIndex + 1, filteredPackages.length - 1)
          );
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedPackageIndex((prevIndex) => Math.max(prevIndex - 1, 0));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (filteredPackages[selectedPackageIndex]) {
            navigate(`/package/${filteredPackages[selectedPackageIndex].name}`);
            setIsPackageDropdownOpen(false);
          }
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between p-2 mb-4">
                <div className="flex items-center space-x-2">
                    <Link to={`/`} className="text-2xl font-bold text-blue-600">ProtoDocs</Link>
                </div>
                
            </div>
            <div className="space-y-6">
                <div className="relative">
                    <div className="flex justify-between items-center">
                        {isPackageDropdownOpen ? (
                            <div className="w-full">
                                <input
                                    ref={packageFilterInputRef}
                                    type="text"
                                    placeholder="Filter packages..."
                                    value={packageFilter}
                                    onChange={(e) => setPackageFilter(e.target.value)}
                                    onKeyDown={handlePackageFilterKeyDown}
                                    className="w-full px-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        ) : (
                            <Link to={`/package/${packageName}`} className="font-mono text-base font-semibold text-gray-800 dark:text-gray-100 mt-1 break-all hover:underline">
                                {packageName}
                            </Link>
                        )}
                        <button
                            onClick={() => setIsPackageDropdownOpen(!isPackageDropdownOpen)}
                            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                        >
                            <svg
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                                />
                            </svg>
                        </button>
                    </div>
                    {isPackageDropdownOpen && (
                    <div className="absolute z-20 mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                        <ul className="max-h-60 overflow-y-auto">
                        {filteredPackages.map((p, index) => (
                            <li key={p.name} className={selectedPackageIndex === index ? 'bg-gray-200 dark:bg-gray-700' : ''}>
                                <button
                                onClick={() => {
                                    navigate(`/package/${p.name}`);
                                    setIsPackageDropdownOpen(false);
                                }}
                                                                className={`w-full text-left px-4 py-2 text-sm truncate ${selectedPackageIndex === index ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-gray-50'}`}
                                title={p.name}
                                >
                                {p.name}
                                </button>
                            </li>
                            ))}
                        </ul>
                    </div>
                    )}
                </div>

            </div>
        </div>
    )
};

export default PackageNav;
