import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import protobuf from 'react-syntax-highlighter/dist/esm/languages/prism/protobuf';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Link } from 'react-router-dom';
import { type Message, type Service, type Enum, type Extension, type ProtoPackage } from '../types';
import { generateSource } from '../lib/proto-source-generator';

SyntaxHighlighter.registerLanguage('protobuf', protobuf);

interface ProtoSourceViewProps {
    item: Message | Service | Enum | Extension;
    type: string;
    allTypes: Map<string, { pkg: ProtoPackage, item: Message | Enum, type: string }>;
    protoPackage: ProtoPackage;
}

const ProtoSourceView = ({ item, type, allTypes, protoPackage }: ProtoSourceViewProps) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customRenderer = (props: any) => {
        const { rows } = props;
        return rows.map((row: any, i: number) => {
            return (
                <span key={i}>
                    {row.children.map((token: any, j: number) => {
                        const typeName = token.children;
                        const typeInfo = allTypes.get(typeName);

                        // If the type is not found, it might be a nested type.
                        // The FQN is constructed in generateMessageSource, so we just need to link it.
                        if (typeInfo) {
                            return (
                                <Link
                                    key={j}
                                    to={`/package/${typeInfo.pkg.name}/${typeInfo.type}/${typeInfo.item.name}`}
                                    className="text-purple-400 hover:underline"
                                >
                                    {typeName.split('.').pop()}
                                </Link>
                            );
                        }
                        return <span key={j}>{token.children}</span>;
                    })}
                </span>
            );
        });
    };

    return (
        <div className="p-8">
            <SyntaxHighlighter
                language="protobuf"
                style={atomDark}
                customStyle={{ background: 'transparent' }}
                renderer={customRenderer}
            >
                {generateSource(item, type, protoPackage, allTypes)}
            </SyntaxHighlighter>
        </div>
    );
};

export default ProtoSourceView;
