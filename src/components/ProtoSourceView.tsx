import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import protobuf from 'react-syntax-highlighter/dist/esm/languages/prism/protobuf';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

import { type Message, type Service, type Enum, type Extension, type ProtoPackage } from '../types';
import { generateSource } from '../lib/proto-source-generator';

SyntaxHighlighter.registerLanguage('protobuf', protobuf);

interface ProtoSourceViewProps {
    item: Message | Service | Enum | Extension;
    type: string;
    protoPackage: ProtoPackage;
    allTypes: Map<string, { pkg: ProtoPackage; item: Message | Enum; type: string; }>;
}

const ProtoSourceView = ({ item, type, protoPackage, allTypes }: ProtoSourceViewProps) => {
    return (
        <div className="p-8">
            <SyntaxHighlighter
                language="protobuf"
                style={atomDark}
                wrapLines={true}
                customStyle={{ background: 'transparent' }}
            >
                {generateSource(item, type, protoPackage, allTypes)}
            </SyntaxHighlighter>
        </div>
    );
};

export default ProtoSourceView;
