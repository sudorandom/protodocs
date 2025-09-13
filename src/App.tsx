import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { type ProtoFile, type ProtoPackage } from './types';
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
        document.body.classList.remove('loading');
      }
    };
    fetchDefaultDescriptors();
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
            <Route path="/" element={<PackageListView packages={protoPackages} />} />
            <Route path="/package/:packageName" element={<PackageDocumentationView packages={protoPackages} />} />
            
            <Route path="/package/:packageName/files/:fileName" element={<PackageDocumentationView packages={protoPackages} />} />
            <Route path="/package/:packageName/:itemType/:itemName" element={<PackageDocumentationView packages={protoPackages} />} />
        </Routes>
    </Router>
  );
}
