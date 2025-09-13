import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { type ProtoFile, type ProtoPackage } from './types';
import { loadDescriptors } from './lib/proto-parser';
import PackageDocumentationView from './components/PackageDocumentationView';
import PackageListView from './components/PackageListView';
import ScrollToTop from './components/ScrollToTop';

export default function App() {
  const [files, setFiles] = useState<ProtoFile[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showSourceInfoWarning, setShowSourceInfoWarning] = useState<boolean>(false);

  useEffect(() => {
    const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        setIsDarkMode(savedTheme === 'dark');
    } else {
        setIsDarkMode(prefersDarkMode);
    }
  }, []);

  useEffect(() => {
    const fetchDefaultDescriptors = async () => {
      try {
        const files = ['/gnostic.binpb', '/protovalidate.binpb', '/googleapis.binpb'];
        const responses = await Promise.all(files.map((file) => fetch(file)));

        for (const response of responses) {
          if (!response.ok) {
            throw new Error(`Failed to fetch default descriptors from ${response.url}`);
          }
        }

        const buffers = await Promise.all(responses.map((res) => res.arrayBuffer()));
        for (const buffer of buffers) {
          await loadDescriptors(buffer, setFiles, setError, setShowSourceInfoWarning);
        }
      } catch (err) {
        setError('Failed to load default descriptors.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDefaultDescriptors();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        setLoading(true);
        for (const file of e.target.files) {
            const buffer = await file.arrayBuffer();
            await loadDescriptors(buffer, setFiles, setError, setShowSourceInfoWarning);
        }
        setLoading(false);
    }
  };

  const toggleDarkMode = () => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      localStorage.theme = 'light';
    } else {
      localStorage.theme = 'dark';
    }
    // Re-apply the class based on the new localStorage value
    if (localStorage.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Initial theme setting on load
  useEffect(() => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
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
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
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
            <Route path="/" element={<PackageListView packages={protoPackages} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} onFileChange={handleFileChange} />} />
            <Route path="/package/:packageName" element={<PackageDocumentationView packages={protoPackages} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />} />
            
            <Route path="/package/:packageName/files/:fileName" element={<PackageDocumentationView packages={protoPackages} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />} />
            <Route path="/package/:packageName/:itemType/:itemName" element={<PackageDocumentationView packages={protoPackages} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />} />
        </Routes>
    </Router>
  );
}
