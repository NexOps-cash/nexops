import { ChainType, Project, WizardDeployRecord } from '../../types';
import { KINDS_BY_ID } from './kinds';
import { generate } from './generator';

/** Synthetic project so TransactionBuilder + parseFunctionMeta work from a saved wizard deployment. */
export function buildProjectFromWizardDeployRecord(rec: WizardDeployRecord): Project | null {
    const kind = KINDS_BY_ID[rec.kindId];
    if (!kind) return null;
    const gen = generate(kind, {
        fields: rec.wizardFieldSnapshot as Record<string, string | number | boolean>,
        enabled: rec.wizardEnabled ?? {},
    });
    const ownerId = rec.deployIdentityWalletId ?? '';
    return {
        id: `wizard-deploy-${rec.id}`,
        name: `${rec.kindName} (wizard)`,
        chain: ChainType.BCH_TESTNET,
        contractCode: gen.source,
        files: [{ name: 'contract.cash', content: gen.source, language: 'cashscript' }],
        versions: [],
        lastModified: rec.timestamp,
        deployedAddress: rec.contractAddress,
        deployedArtifact: rec.artifact,
        constructorArgs: [...rec.constructorArgs],
        executionHistory: [],
        deploymentRecord: {
            contractAddress: rec.contractAddress,
            ownerWalletId: ownerId,
            funderWalletId: ownerId,
            constructorArgs: [...rec.constructorArgs],
            timestamp: rec.timestamp,
        },
    };
}
