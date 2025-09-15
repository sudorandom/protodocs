import React from 'react';
import ReactMarkdown from 'react-markdown';
import { type Message, type Field } from '../types';

interface CompactMessageViewProps {
  message: Message;
  title: string;
  renderFieldType: (field: Field, messagePackage: string) => React.ReactNode;
  messagePackage: string;
}

const CompactMessageView = ({ message, title, renderFieldType, messagePackage }: CompactMessageViewProps) => {
  if (!message) return null;
  return (
    <div className="mt-4">
      <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-2">{title}: <span className="font-mono text-purple-500">{message.name}</span></h4>
      <ul className="list-none space-y-2 pl-4 border-l-2 border-gray-200 dark:border-gray-600">
        {message.fields.map((field: Field) => (
          <li key={field.tag} className="bg-gray-100 dark:bg-gray-700/50 p-3 rounded-md">
            <div className="text-sm">
              <p className="font-mono">
                <span className="text-purple-600 dark:text-purple-300 font-medium">{field.name}</span>
                <span className="text-green-500 dark:text-green-400 text-xs ml-2">
                  [{field.isRepeated && !field.isMap ? 'repeated ' : ''}
                  {renderFieldType(field, messagePackage)}]
                </span>
              </p>
            </div>
            {field.description && <div className="prose dark:prose-invert max-w-none text-xs"><ReactMarkdown>{field.description}</ReactMarkdown></div>}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CompactMessageView;
