import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { type ProtoPackage, type Message, type Service, type Enum, type Extension, type ProtoFile } from '../types';
import { getAnchorId } from '../utils';
import FileTreeView from './FileTreeView';
import PackageNav from './PackageNav';
import ProtoDetailView from './ProtoDetailView';
import FileSourceContentView from './FileSourceContentView';
import NavSection from './NavSection';
import { uniqueBy } from '../utils';

interface PackageDocumentationViewProps {
    packages: ProtoPackage[];
    isDarkMode: boolean;
    toggleDarkMode: () => void;
}

const PackageDocumentationView = ({ packages, isDarkMode, toggleDarkMode }: PackageDocumentationViewProps) => {
  const { packageName, itemType, itemName, fileName } = useParams();
  const [selectedItem, setSelectedItem] = useState<Message | Service | Enum | Extension | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const mainRef = useRef<HTMLDivElement>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const protoPackage = packages.find(p => p.name === packageName);

  const mergedProtoFile = useMemo(() => {
    if (!protoPackage) return null;

    const description = protoPackage.files.map(f => f.description).filter(d => d).join('\n\n');
    const options = protoPackage.files.reduce((acc, file) => {
        if (file.options) {
            return {...acc, ...file.options};
        }
        return acc;
    }, {});

    return {
        fileName: '',
        package: protoPackage.name,
        description: description,
        messages: uniqueBy(protoPackage.files.flatMap(f => f.messages)).filter(m => !m.isMapEntry),
        services: uniqueBy(protoPackage.files.flatMap(f => f.services)),
        enums: uniqueBy(protoPackage.files.flatMap(f => f.enums)),
        extensions: uniqueBy(protoPackage.files.flatMap(f => f.extensions || [])),
        edition: protoPackage.files.length > 0 ? protoPackage.files[0].edition : undefined,
        options: options,
    };
  }, [protoPackage]);

  const allTypes = useMemo(() => {
    const map = new Map<string, {pkg: ProtoPackage, item: Message | Enum, type: string}>();
    packages.forEach(pkg => {
        const messages = uniqueBy(pkg.files.flatMap(f => f.messages));
        const enums = uniqueBy(pkg.files.flatMap(f => f.enums));
        messages.forEach(m => map.set(`${pkg.name}.${m.name}`, {pkg, item: m, type: 'messages'}));
        enums.forEach(e => map.set(`${pkg.name}.${e.name}`, {pkg, item: e, type: 'enums'}));
    });
    return map;
  }, [packages]);

  useEffect(() => {
    if (mergedProtoFile && itemType && itemName) {
        let foundItem: Message | Service | Enum | Extension | undefined;
        let foundType = '';
        if (itemType === 'messages') { foundItem = mergedProtoFile.messages.find((msg) => msg.name === itemName); foundType = 'messages'; }
        else if (itemType === 'services') { foundItem = mergedProtoFile.services.find((svc) => svc.name === itemName); foundType = 'services'; }
        else if (itemType === 'enums') { foundItem = mergedProtoFile.enums.find((enm) => enm.name === itemName); foundType = 'enums'; }
        else if (itemType === 'extensions') { foundItem = mergedProtoFile.extensions.find((ext) => ext.name === itemName); foundType = 'extensions'; }

        if (foundItem) {
            setSelectedItem(foundItem);
            setSelectedItemType(foundType);
        } else {
            setSelectedItem(null);
            setSelectedItemType(null);
        }
    } else {
        setSelectedItem(null);
        setSelectedItemType(null);
    }
  }, [mergedProtoFile, itemType, itemName]);

  useEffect(() => {
    if (selectedItem && selectedItemType) {
      const anchorId = getAnchorId(selectedItemType, selectedItem.name);
      const element = document.getElementById(anchorId);
      if (element) { element.scrollIntoView({ behavior: 'smooth' }); }
    }
  }, [selectedItem, selectedItemType]);

  useEffect(() => {
      if (itemType) {
          setExpandedSection(itemType);
      } else if (fileName) {
          setExpandedSection('files');
      }
  }, [itemType, fileName]);

  const handleSectionToggle = (section: string) => {
      setExpandedSection(prev => (prev === section ? null : section));
  };

  if (!mergedProtoFile) {
      return <div>Package not found</div>
  }

  const filteredServices = mergedProtoFile.services.filter((svc) => svc.name.toLowerCase().includes(filterQuery.toLowerCase()));
  const filteredMessages = mergedProtoFile.messages.filter((msg) => msg.name.toLowerCase().includes(filterQuery.toLowerCase()));
  const filteredEnums = mergedProtoFile.enums.filter((enm) => enm.name.toLowerCase().includes(filterQuery.toLowerCase()));
  const filteredExtensions = mergedProtoFile.extensions.filter((ext) => ext.name.toLowerCase().includes(filterQuery.toLowerCase()));

  const sidebarContent = (
    <>
        <PackageNav packages={packages} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
        <div className="flex-grow overflow-y-auto overflow-y-auto">
            <div className="p-2 mb-4">
                <input type="text" placeholder="Filter definitions..." value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} className="w-full px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="space-y-6">
                <NavSection title="Services" items={filteredServices} selectedItem={selectedItem} selectedItemType={selectedItemType} itemType="services" packageName={packageName!} isExpanded={expandedSection === 'services'} onToggle={() => handleSectionToggle('services')} />
                <NavSection title="Messages" items={filteredMessages} selectedItem={selectedItem} selectedItemType={selectedItemType} itemType="messages" packageName={packageName!} isExpanded={expandedSection === 'messages'} onToggle={() => handleSectionToggle('messages')} />
                <NavSection title="Enums" items={filteredEnums} selectedItem={selectedItem} selectedItemType={selectedItemType} itemType="enums" packageName={packageName!} isExpanded={expandedSection === 'enums'} onToggle={() => handleSectionToggle('enums')} />
                <NavSection title="Extensions" items={filteredExtensions} selectedItem={selectedItem} selectedItemType={selectedItemType} itemType="extensions" packageName={packageName!} isExpanded={expandedSection === 'extensions'} onToggle={() => handleSectionToggle('extensions')} />
                <FileTreeView files={protoPackage!.files} packageName={packageName!} isExpanded={expandedSection === 'files'} onToggle={() => handleSectionToggle('files')} />
            </div>
        </div>
    </>
  );

  return (
    <div className={`font-sans antialiased text-gray-800 dark:text-gray-200 min-h-screen flex flex-col md:flex-row transition-colors duration-500 bg-white dark:bg-gray-950`}>
        <div className="md:hidden flex items-center justify-between p-4 border-b dark:border-gray-700 sticky top-0 bg-gray-50 dark:bg-gray-900 z-30">
            <Link to={`/package/${packageName}`} className="text-xl font-bold text-blue-600 truncate">{packageName}</Link>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-md text-gray-500 dark:text-gray-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
            </button>
        </div>

        {/* Sidebar for mobile */}
        <div className={`fixed inset-0 z-40 flex md:hidden ${isSidebarOpen ? '' : 'pointer-events-none'}`}>
            <div className="fixed inset-0 bg-black/20" onClick={() => setIsSidebarOpen(false)}></div>
            <div className={`relative flex-1 flex flex-col max-w-sm w-full bg-white dark:bg-gray-950 shadow-xl p-4 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                {sidebarContent}
            </div>
        </div>

        {/* Sidebar for desktop */}
        <div className="hidden md:flex flex-shrink-0 w-96 border-r border-gray-200 dark:border-gray-700 p-4 shadow-xl flex-col h-screen sticky top-0">
            {sidebarContent}
        </div>

        <main ref={mainRef} className="flex-1 w-full bg-white dark:bg-gray-900 md:rounded-l-3xl shadow-xl z-20 transition-colors duration-500">
            {fileName ? (
                <FileSourceContentView packages={packages} />
            ) : (
                <ProtoDetailView item={selectedItem} type={selectedItemType} proto={mergedProtoFile!} allTypes={allTypes} protoPackage={protoPackage!} />
            )}
        </main>
    </div>
  );
};

export default PackageDocumentationView;