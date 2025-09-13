import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  type Rpc,
  type EnumValue,
  type Annotation,
  type ProtoPackage,
  type Message,
  type Service,
  type Enum,
  type Extension,
  type ProtoFile,
  type Field } from '../types';
import { getAnchorId, getCommonPathPrefix, scalarDocUrls, wellKnownTypeUrls, getFieldAnchorId } from '../utils';
import ExpandableMarkdown from './ExpandableMarkdown';
import ProtoSourceView from './ProtoSourceView';
import CompactMessageView from './CompactMessageView';

interface ProtoDetailViewProps {
    item: Message | Service | Enum | Extension | null;
    type: string | null;
    proto: ProtoFile;
    allTypes: Map<string, {pkg: ProtoPackage, item: Message | Enum, type: string}>;
    protoPackage: ProtoPackage;
}

import DetailSection from './DetailSection';

const ProtoDetailView = ({ item, type, proto, allTypes, protoPackage }: ProtoDetailViewProps) => {
  useParams();
  const [expandedRpc, setExpandedRpc] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  const navigate = useNavigate();

  if (!item) {
    const fileNames = protoPackage.files.map(f => f.fileName);
    const commonPrefix = getCommonPathPrefix(fileNames);
    return (
        <div className="p-8">
            <div className="border-b dark:border-gray-700 pb-4">
                <h2 className="text-4xl font-extrabold text-gray-900 dark:text-gray-100 font-mono">{proto.package}</h2>
                {proto.description && <div className="prose dark:prose-invert max-w-none mt-2"><ExpandableMarkdown description={proto.description} /></div>}
            </div>

            <DetailSection
                title="Services"
                items={proto.services}
                renderItem={service => (
                    <li key={service.name} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                        <Link to={`/package/${protoPackage.name}/services/${service.name}`} className="font-mono text-blue-600 dark:text-blue-400 hover:underline">{service.name}</Link>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">{service.rpcs.length} methods</div>
                    </li>
                )}
            />

            <DetailSection
                title="Messages"
                items={proto.messages}
                renderItem={message => (
                    <li key={message.name} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                        <Link to={`/package/${protoPackage.name}/messages/${message.name}`} className="font-mono text-blue-600 dark:text-blue-400 hover:underline">{message.name}</Link>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">{message.fields.length} fields</div>
                    </li>
                )}
            />

            <DetailSection
                title="Enums"
                items={proto.enums}
                renderItem={enumItem => (
                    <li key={enumItem.name} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                        <Link to={`/package/${protoPackage.name}/enums/${enumItem.name}`} className="font-mono text-blue-600 dark:text-blue-400 hover:hover:underline">{enumItem.name}</Link>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">{enumItem.values.length} values</div>
                    </li>
                )}
            />

            <DetailSection
                title="Extensions"
                items={proto.extensions || []}
                renderItem={ext => (
                    <li key={`${ext.name}-${ext.extendee}`} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                        <Link to={`/package/${protoPackage.name}/extensions/${ext.name}`} className="font-mono text-blue-600 dark:text-blue-400 hover:underline">{ext.name}</Link>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">extending <span className="font-mono text-purple-500">{ext.extendee}</span></div>
                        {ext.description && <div className="prose dark:prose-invert max-w-none text-xs mt-2"><ExpandableMarkdown description={ext.description} /></div>}
                    </li>
                )}
            />

            <DetailSection
                title="Files"
                items={protoPackage.files}
                titleAddon={commonPrefix && (
                    <span className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 truncate" title={commonPrefix}>
                        {commonPrefix}
                    </span>
                )}
                renderItem={file => (
                    <li key={file.fileName} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-sm list-none">
                        <Link to={`/package/${protoPackage.name}/files/${file.fileName.replace(/\//g, '+')}`} className="font-mono text-blue-600 dark:text-blue-400 hover:underline break-all">{file.fileName.substring(commonPrefix.length)}</Link>
                        <div className="flex space-x-4 text-sm text-gray-500 dark:text-gray-400 mt-2">
                            {file.services.length > 0 && <span>{file.services.length} services</span>}
                            {file.messages.length > 0 && <span>{file.messages.length} messages</span>}
                            {file.enums.length > 0 && <span>{file.enums.length} enums</span>}
                            {(file.extensions?.length || 0) > 0 && <span>{file.extensions.length} extensions</span>}
                        </div>
                    </li>
                )}
            />
        </div>
    );
  }

  const findAndSelect = (typeName: string) => {
    const found = allTypes.get(typeName);
    if (found) {
        const { pkg, item, type } = found;
        navigate(`/package/${pkg.name}/${type}/${item.name}`);
    }
  };

  const renderFieldType = (field: Field, messagePackage: string) => {
    if (field.isMap) {
        return (
            <span className="font-semibold">
                map&lt;{renderType(field.keyType!, messagePackage)}, {renderType(field.valueType!, messagePackage)}&gt;
            </span>
        );
    }
    return renderType(field.type, messagePackage);
  };

  const renderType = (type: string, messagePackage: string) => {
    if (scalarDocUrls[type]) {
      return (
        <a href={scalarDocUrls[type]} target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-500 dark:text-gray-400 hover:text-blue-500 hover:underline">
          {type}
        </a>
      );
    }
    if (wellKnownTypeUrls[type]) {
        return (
            <a href={wellKnownTypeUrls[type]} target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-500 dark:text-gray-400 hover:text-blue-500 hover:underline">
                {type.split('.').pop()}
            </a>
        );
    }

    const isExternal = !type.startsWith(messagePackage);
    const typeName = isExternal ? type : type.split('.').pop();

    if (!typeName) {
        return <span className="font-semibold text-red-500">Unknown Type</span>;
    }

    return (
      <button onClick={() => findAndSelect(type)} className="font-semibold text-purple-600 dark:text-purple-300 hover:text-purple-400 dark:hover:text-purple-200 underline transition-colors duration-200">
        {typeName}
      </button>
    );
  }

  const renderFields = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">Fields</h3>
      <ul className="list-none space-y-2">
        {(item as Message).fields.map((field: Field) => (
          <li key={field.tag} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-sm" id={getFieldAnchorId(type!, item.name, field.name)}>
            <div className="flex items-center justify-between">
              <p className="font-mono text-sm text-purple-600 dark:text-purple-300 font-semibold">{field.tag}. {field.name} <a href={`#${getFieldAnchorId(type!, item.name, field.name)}`} className="hover:underline text-gray-400 dark:text-gray-400">¶</a></p>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {field.isRepeated ? 'repeated ' : ''}
                {renderFieldType(field, proto.package)}
              </span>
            </div>
            <div className="prose dark:prose-invert max-w-none text-sm"><ExpandableMarkdown description={field.description} /></div>
            {field.annotations && field.annotations.length > 0 && (
              <div className="mt-3 p-2 bg-gray-200 dark:bg-gray-700 rounded-md">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-200">Annotations:</span>
                <ul className="font-mono text-xs text-gray-800 dark:text-gray-100 mt-1 space-y-1">
                  {field.annotations.map((annotation: Annotation, index: number) => (<li key={index} className="break-words">{annotation}</li>))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );

  const renderEnums = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">Values</h3>
      <ul className="list-none space-y-2">
        {(item as Enum).values.map((value: EnumValue) => (
          <li key={value.value} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-sm" id={getFieldAnchorId(type!, item.name, value.name)}>
            <div className="flex items-center justify-between">
              <p className="font-mono text-sm text-purple-600 dark:text-purple-300 font-semibold">{value.name} <a href={`#${getFieldAnchorId(type!, item.name, value.name)}`} className="hover:underline text-gray-400 dark:text-gray-600">¶</a></p>
              <span className="text-xs text-gray-500 dark:text-gray-400"> = {value.value}</span>
            </div>
			<div className="prose dark:prose-invert max-w-none text-sm"><ExpandableMarkdown description={value.description} /></div>
          </li>
        ))}
      </ul>
    </div>
  );

  const renderRpcs = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">RPCs</h3>
      <ul className="list-none space-y-2">
        {(item as Service).rpcs.map((rpc: Rpc) => {
          const isExpanded = expandedRpc === rpc.name;
          const requestInfo = allTypes.get(rpc.request);
          const responseInfo = allTypes.get(rpc.response);
          const requestMessage = requestInfo?.type === 'messages' ? requestInfo.item as Message : undefined;
          const responseMessage = responseInfo?.type === 'messages' ? responseInfo.item as Message : undefined;

          return (
            <li key={rpc.name} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-sm" id={getFieldAnchorId(type!, item.name, rpc.name)}>
              <div
                className="flex justify-between items-center cursor-pointer"
                onClick={() => setExpandedRpc(isExpanded ? null : rpc.name)}
              >
                <div>
                  <div className="font-bold text-lg text-blue-600 dark:text-blue-400">
                    <a href={`#${getFieldAnchorId(type!, item.name, rpc.name)}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>{rpc.name}</a>
                  </div>
                </div>
                <svg className={`h-6 w-6 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-300 mt-1 flex items-center">
                  {rpc.isClientStream ? (<><span className="font-mono text-gray-500 dark:text-gray-400">stream</span><button onClick={(e) => { e.stopPropagation(); findAndSelect(rpc.request); }} className="font-mono text-purple-600 dark:text-purple-300 hover:text-purple-400 dark:hover:text-purple-200 underline transition-colors duration-200 ml-1">{rpc.request.startsWith(proto.package) ? rpc.request.split('.').pop() : rpc.request}</button></>) : (<button onClick={(e) => { e.stopPropagation(); findAndSelect(rpc.request); }} className="font-mono text-purple-600 dark:text-purple-300 hover:text-purple-400 dark:hover:text-purple-200 underline transition-colors duration-200">{rpc.request.startsWith(proto.package) ? rpc.request.split('.').pop() : rpc.request}</button>)}
                  <span className="mx-2">&rarr;</span>
                  {rpc.isServerStream || rpc.isBidi ? (<><span className="font-mono text-gray-500 dark:text-gray-400">stream</span><button onClick={(e) => { e.stopPropagation(); findAndSelect(rpc.response); }} className="font-mono text-green-600 hover:text-green-400 underline transition-colors duration-200 ml-1">{rpc.response.startsWith(proto.package) ? rpc.response.split('.').pop() : rpc.response}</button></>) : (<button onClick={(e) => { e.stopPropagation(); findAndSelect(rpc.response); }} className="font-mono text-green-600 hover:text-green-400 underline transition-colors duration-200">{rpc.response.startsWith(proto.package) ? rpc.response.split('.').pop() : rpc.response}</button>)}
              </div>
              <div className="prose dark:prose-invert max-w-none text-sm"><ExpandableMarkdown description={rpc.description} /></div>

              <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[1000px] mt-4 pt-4 border-t border-gray-200 dark:border-gray-700' : 'max-h-0'}`}>
                  {requestMessage && <CompactMessageView message={requestMessage} title="Request" renderFieldType={renderFieldType} messagePackage={requestInfo!.pkg.name} />}
                  {responseMessage && <CompactMessageView message={responseMessage} title="Response" renderFieldType={renderFieldType} messagePackage={responseInfo!.pkg.name} />}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );

  const renderExtension = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">Details</h3>
      <ul className="list-none space-y-2">
          <li className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <p className="font-mono text-sm text-purple-600 dark:text-purple-300 font-semibold">extending {renderType((item as Extension).extendee, proto.package)}</p>
            </div>
          </li>
          <li className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <p className="font-mono text-sm text-purple-600 dark:text-purple-300 font-semibold">{(item as Extension).tag}. {(item as Extension).name}</p>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {(item as Extension).isRepeated ? 'repeated ' : ''}
                {renderType((item as Extension).type, proto.package)}
              </span>
            </div>
          </li>
      </ul>
    </div>
  );

  return (
    <div className="p-8 space-y-6">
      <div className="border-b dark:border-gray-700 pb-4" id={getAnchorId(type!, item.name)}>
        <div className="flex justify-between items-center">
            <h2 className="text-4xl font-extrabold text-gray-900 dark:text-gray-100">{item.name}</h2>
            <button onClick={() => setShowSource(!showSource)} className="text-sm text-blue-600 dark:text-blue-400 hover:underline ml-4">
                {showSource ? 'View Details' : 'View Source'}
            </button>
        </div>
        <div className="prose dark:prose-invert max-w-none text-sm"><ExpandableMarkdown description={item.description} /></div>
      </div>
      {showSource ? (
          <ProtoSourceView item={item} type={type!} />
      ) : (
          <>
              {type === 'messages' && renderFields()}
              {type === 'enums' && renderEnums()}
              {type === 'services' && renderRpcs()}
              {type === 'extensions' && renderExtension()}
          </>
      )}
    </div>
  );
};

export default ProtoDetailView;