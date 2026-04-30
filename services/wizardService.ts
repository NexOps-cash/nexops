import { KINDS, KINDS_BY_ID } from './wizard/kinds';
import { defaultValueForField } from './wizard/schema';
import { generate } from './wizard/generator';

export interface TemplateParameter {
    id: string;
    label: string;
    type: 'string' | 'number' | 'address';
    description: string;
    placeholder?: string;
    defaultValue?: string | number;
}

export interface SpendPath {
    pathName: string;
    whoSigns: string;
    when: string;
    valueRule: string;
    risk: string;
}

export interface ContractTemplate {
    id: string;
    name: string;
    description: string;
    mode: 'starter' | 'policy';
    category: 'Vault' | 'DeFi' | 'Utility' | 'Governance' | 'Escrow' | 'Vesting';
    parameters: TemplateParameter[];
    spendPaths?: SpendPath[];
    generateSource: (params: Record<string, any>) => string;
}

function legacyType(t: string): TemplateParameter['type'] {
    if (t === 'int' || t === 'blockHeight' || t === 'unixTime') return 'number';
    if (t === 'cashAddress') return 'address';
    return 'string';
}

function legacyCategory(id: string): ContractTemplate['category'] {
    if (id === 'multisig') return 'Vault';
    if (id === 'htlc') return 'Escrow';
    if (id === 'escrow') return 'Escrow';
    if (id === 'vesting') return 'Vesting';
    if (id === 'cashToken') return 'Utility';
    return 'Governance';
}

function kindToLegacyTemplate(kindId: string): ContractTemplate {
    const kind = KINDS_BY_ID[kindId];
    return {
        id: kind.id,
        name: kind.name,
        description: kind.summary,
        mode: kind.id === 'multisig' || kind.id === 'htlc' ? 'starter' : 'policy',
        category: legacyCategory(kind.id),
        parameters: kind.fields.map((field) => ({
            id: field.id,
            label: field.label,
            type: legacyType(field.type),
            description: field.description,
            placeholder: field.placeholder,
            defaultValue: typeof field.defaultValue === 'number' || typeof field.defaultValue === 'string'
                ? field.defaultValue
                : undefined,
        })),
        generateSource: (params) => {
            const enabled: Record<string, boolean> = {};
            kind.features.forEach((f) => {
                enabled[f.id] = false;
            });
            const merged: Record<string, string | number | boolean> = {};
            kind.fields.forEach((field) => {
                merged[field.id] = params[field.id] ?? defaultValueForField(field);
            });
            return generate(kind, { fields: merged, enabled }).source;
        },
    };
}

export const CONTRACT_TEMPLATES: ContractTemplate[] = KINDS.map((k) => kindToLegacyTemplate(k.id));

export function generateFromTemplate(templateId: string, params: Record<string, any>): string {
    const template = CONTRACT_TEMPLATES.find((t) => t.id === templateId);
    if (!template) throw new Error('Template not found');
    return template.generateSource(params);
}
