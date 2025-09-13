import { useNavigate } from 'react-router-dom';
import { type ProtoPackage, type Config } from '../types';
import { uniqueBy } from '../utils';
import MarkdownView from './MarkdownView';

interface PackageListViewProps {
    packages: ProtoPackage[];
    config: Config | null;
}

const PackageListView = ({ packages, config }: PackageListViewProps) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-500">
      <header className="p-4 flex justify-between items-center container mx-auto">
        <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">{config?.title ?? 'ProtoDocs'}</h1>
        
      </header>
      <div className="container mx-auto p-8 pt-4">
        {config?.front_page_markdown_file && (
          <div className="mb-12">
            <MarkdownView url={config.front_page_markdown_file} />
          </div>
        )}
        <h2 className="text-5xl font-extrabold text-center mb-4 text-gray-900 dark:text-gray-100">Available Packages</h2>
        <p className="text-center text-lg text-gray-600 dark:text-gray-400 mb-12">Select a package to view its documentation.</p>
        <div className="max-w-4xl mx-auto space-y-8">
          {packages.map((pkg) => {
            const totalServices = uniqueBy(pkg.files.flatMap(f => f.services)).length;
            const totalMessages = uniqueBy(pkg.files.flatMap(f => f.messages)).length;
            const totalEnums = uniqueBy(pkg.files.flatMap(f => f.enums)).length;
            const totalExtensions = uniqueBy(pkg.files.flatMap(f => f.extensions || [])).length;

            return (
              <div key={pkg.name} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border dark:border-gray-700 flex flex-col md:flex-row items-center justify-between hover:shadow-xl transition-shadow duration-300">
                <div>
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 font-mono">{pkg.name}</h3>
                  <div className="flex space-x-4 text-sm text-gray-500 mt-2">
                    {totalServices > 0 && <span><span className="font-semibold">{totalServices}</span> Services</span>}
                    {(totalMessages + totalEnums) > 0 && <span><span className="font-semibold">{totalMessages + totalEnums}</span> Types</span>}
                    {totalExtensions > 0 && <span><span className="font-semibold">{totalExtensions}</span> Extensions</span>}
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/package/${pkg.name}`)}
                  className="mt-4 md:mt-0 bg-blue-600 text-white font-semibold py-2 px-5 rounded-lg hover:bg-blue-700 transition-colors duration-300 self-start md:self-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 text-sm">
                  View Documentation
                </button>
              </div>
            );
          })}
        </div>
        {config?.bottom_of_front_page_markdown_file && (
          <div className="mt-12">
            <MarkdownView url={config.bottom_of_front_page_markdown_file} />
          </div>
        )}
      </div>
    </div>
  );
};

export default PackageListView;
