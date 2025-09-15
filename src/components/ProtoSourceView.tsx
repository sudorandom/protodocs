import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import protobuf from 'react-syntax-highlighter/dist/esm/languages/prism/protobuf';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

SyntaxHighlighter.registerLanguage('protobuf', protobuf);
import { type Message, type Service, type Enum, type Extension } from '../types';
import { generateSource } from '../lib/proto-source-generator';

const ProtoSourceView = ({ item, type }: { item: Message | Service | Enum | Extension, type: string }) => {
    return (
        <div className="p-8">
            <SyntaxHighlighter language="protobuf" style={atomDark} customStyle={{ background: 'transparent' }}>
                {generateSource(item, type)}
            </SyntaxHighlighter>
        </div>
    );
};

export default ProtoSourceView;
