import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { type ProtoFile, type ProtoPackage, type Config } from './types';
import { loadDescriptors } from './lib/proto-parser';
import PackageDocumentationView from './components/PackageDocumentationView';
import PackageListView from './components/PackageListView';
import ScrollToTop from './components/ScrollToTop';
import ErrorPage from './components/ErrorPage';

export default function App() {
  const [files, setFiles] = useState<ProtoFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showSourceInfoWarning, setShowSourceInfoWarning] = useState<boolean>(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const savedMode = localStorage.getItem('darkMode');
    return savedMode ? JSON.parse(savedMode) : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(prevMode => !prevMode);
  };

  useEffect(() => {
    const fetchConfigAndDescriptors = async () => {
      try {
        const configResponse = await fetch('/config.json');
        if (!configResponse.ok) {
          throw new Error('Failed to fetch config.json');
        }
        const configData: Config = await configResponse.json();
        setConfig(configData);
        document.title = configData.title;

        const files = configData.descriptor_files;
        const responses = await Promise.all(files.map((file) => fetch(file)));

        for (const response of responses) {
          if (!response.ok) {
            throw new Error(`Failed to fetch descriptors from ${response.url}`);
          }
        }

        const buffers = await Promise.all(responses.map((res) => res.arrayBuffer()));
        for (const buffer of buffers) {
          await loadDescriptors(buffer, setFiles, setError, setShowSourceInfoWarning);
        }
      } catch (err) {
        setError('Failed to load descriptors.');
        console.error(err);
      } finally {
        setLoading(false);
        document.body.classList.remove('loading');
      }
    };
    fetchConfigAndDescriptors();
  }, []);

  const packages = files.reduce((acc: Record<string, ProtoFile[]>, file) => {
    if (!acc[file.package]) {
      acc[file.package] = [];
    }
    acc[file.package].push(file);
    return acc;
  }, {});

  const protoPackages: ProtoPackage[] = Object.entries(packages).map(([name, files]) => ({ name, files }));

  if (loading) {
    return null;
  }

  if (error) {
    return <ErrorPage title="Error" message={error} />;
  }

  return (
    <Router>
        <ScrollToTop />
        {showSourceInfoWarning && (
            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4" role="alert">
                <p className="font-bold">Warning</p>
                <p>Comments and some other source information may not be displayed. To enable this, generate your descriptor files with the `--include-source-info` flag.</p>
            </div>
        )}
        <Routes>
            <Route path="/" element={<PackageListView packages={protoPackages} config={config} />} />
            <Route path="/package/:packageName" element={<PackageDocumentationView packages={protoPackages} />} />
            
            <Route path="/package/:packageName/files/:fileName" element={<PackageDocumentationView packages={protoPackages} />} />
            <Route path="/package/:packageName/:itemType/:itemName" element={<PackageDocumentationView packages={protoPackages} />} />
            <Route path="/package/:packageName/:itemType/:itemName/source" element={<PackageDocumentationView packages={protoPackages} />} />
        </Routes>
    </Router>
  );
}

