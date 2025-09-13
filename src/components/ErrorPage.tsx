import React from 'react';

interface ErrorPageProps {
  title: string;
  message: string;
}

const ErrorPage: React.FC<ErrorPageProps> = ({ title, message }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="max-w-md p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-red-500 mb-4">{title}</h1>
        <p>{message}</p>
      </div>
    </div>
  );
};

export default ErrorPage;
