import { AssetsApiClient, AssetsPluginContext, queryForSelection } from '@woodwing/assets-client-sdk';
import './style.css';
import { Asset } from '@woodwing/assets-client-sdk/dist/model/asset';
import * as config from '../config.js';

const fieldsToIgnore = ['filename', 'previewState', 'thumbnailState'];
let apiClient: AssetsApiClient;
let stampFields: any;
let stampHits: any;
let fieldInfo: any;
let contextService: AssetsPluginContext;

const stampsListElement = document.getElementById('stamps-list');
const bodyElement = document.querySelector('body');

const getSelection = () => {
    // Get current asset selection from context
    return contextService.context.activeTab.originalAssetSelection.filter((hit) => {
        // We don't want to stamp stamp-templates by accident
        return !hit.metadata.filename.endsWith('.stamp');
    });
};

const determineStampFields = () => {
    return apiClient.fieldinfo()
        .then(data => {
            fieldInfo = data;
            const fields = data.fieldInfoByName;
            stampFields = Object.keys(fields).filter(fieldName => {
                return !fieldsToIgnore.includes(fieldName) && fields.hasOwnProperty(fieldName) && fields[fieldName].editable;
            });
        })
        .catch(error => console.error('Fieldinfo call failed with error:', error));
};

const loadStamps = () => {
    return apiClient.search({
        q: 'extension:stamp',
        sort: 'filename'
    }).then((data) => {
        stampHits = {};
        const validHits = data.hits.filter(hit => !!getStampMetadata(hit));
        validHits.forEach(hit => stampHits[hit.id] = getStampMetadata(hit));

        const stampsHtml = validHits.reduce((html: string, hit) => {
            return html + `<li class="stamp-item" data-hit-id="${hit.id}">`
                + `<div class="stamp">${hit.metadata.baseName}</div>`
                + getMetadataHtml(stampHits[hit.id])
                + '</li>';
        }, '');

        stampsListElement.innerHTML = stampsHtml;
        stampsListElement.querySelectorAll('.stamp-item').forEach(element => {
            element.addEventListener('click', () => stamp(element as HTMLElement));
        });
    }).catch(error => console.error('Search call failed with error:', error));
};

const getMetadataHtml = (stampMetadata: any) => {
    const metadataHtml = Object.keys(stampMetadata)
        .filter(fieldName => stampMetadata.hasOwnProperty(fieldName))
        .reduce((html: string, fieldName) => {
            const fieldLabel = apiClient.messages.getString('field_label.' + fieldName);
            const formattedValue = getFormattedValue(fieldName, stampMetadata[fieldName]);
            return html + `<div class="stamp-metadata-field">
                    <span class="stamp-metadata-name">${fieldLabel}: </span>
                    <span class="stamp-metadata-value">${formattedValue}</span>
                </div>`;
        }, '');

    return `<div class="stamp-metadata">${metadataHtml}</div>`;
};

const getFormattedValue = (fieldName: string, fieldValue: any) => {
    const fi = fieldInfo.fieldInfoByName[fieldName];
    if (fi.datatype === 'datetime') return fieldValue.formatted;
    if (fi.multivalue) return fieldValue.join(', ');
    return fieldValue;
};

const getStampMetadata = (hit: Asset) => {
    const validFields = Object.keys(hit.metadata)
        .filter(fieldName => stampFields.includes(fieldName) && hit.metadata.hasOwnProperty(fieldName));
    if (!validFields.length) return null;

    return validFields.reduce((stampMetadata: { [key: string]: any }, fieldName) => {
        stampMetadata[fieldName] = hit.metadata[fieldName];
        return stampMetadata;
    }, {});
};

const stamp = (element: HTMLElement) => {
    const selectedHits = getSelection();
    if (!selectedHits || selectedHits.length == 0) return;

    const query = queryForSelection(selectedHits);
    const stampHitId = element.dataset.hitId;
    const metadata = getMetadataToUpdate(stampHits[stampHitId]);
    apiClient.updatebulk(query, metadata);
};

const formatMetadata = (fieldName: string, metadata: any): string => {
    const fi = fieldInfo.fieldInfoByName[fieldName];
    if (fi.datatype === 'datetime') return metadata.value;
    if (fi.multivalue) return '+' + metadata.join(', +');
    return metadata;
};

const getMetadataToUpdate = (sourceMetadata: any) => {
    return Object.keys(sourceMetadata).reduce((metadata: {[key: string]: string}, fieldName) => {
        metadata[fieldName] = formatMetadata(fieldName, sourceMetadata[fieldName]);
        return metadata;
    }, {});
};

const togglePanel = () => {
    const selectedHits = getSelection();

    bodyElement.classList.remove('no-stamps', 'no-selection', 'stamps-panel');

    if (stampHits && Object.keys(stampHits).length > 0 && selectedHits && selectedHits.length > 0) {
        return bodyElement.classList.add('stamps-panel');       
    }

    if (!stampHits || Object.keys(stampHits).length == 0) {
        return bodyElement.classList.add('no-stamps');
    }

    bodyElement.classList.add('no-selection');
};

(async () => {
    contextService = await AssetsPluginContext.get(config.CLIENT_URL_WHITELIST);
    apiClient = AssetsApiClient.fromPluginContext(contextService);

    // 1. Load messages from server
    try {
        await apiClient.loadMessages();
    } catch (error) {
        console.error('Messages call failed with error:', error);
    }

    // 2. Determine which fields should be stamped
    await determineStampFields();

    // 3. Load stamp files
    await loadStamps();

    // 4. Show the right panel, startup sequence finished
    togglePanel();
    contextService.subscribe(togglePanel);
})();