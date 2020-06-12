import { AssetsApiClient, AssetsPluginContext, queryForSelection } from '@woodwing/assets-client-sdk';
import './style.css';
import { Asset } from '@woodwing/assets-client-sdk/dist/model/asset';

const fieldsToIgnore = ['filename', 'previewState', 'thumbnailState'];
let apiClient: AssetsApiClient;
let stampFields: any;
let stampHits: any;
let fieldInfo: any;
let contextService: AssetsPluginContext;

const stampsListElement = document.getElementById('stamps-list');

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

        const stampsHtml = validHits.reduce((acc: string, hit) => {
            return acc + `<li class="stamp-item" data-hit-id="${hit.id}">`
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
    const html = Object.keys(stampMetadata)
        .filter(fieldName => stampMetadata.hasOwnProperty(fieldName))
        .reduce((acc: string, fieldName) => {
            const fieldLabel = apiClient.messages.getString('field_label.' + fieldName);
            const formattedValue = getFormattedValue(fieldName, stampMetadata[fieldName]);
            return acc + '<div class="stamp-metadata-field"><span class="stamp-metadata-name">' + fieldLabel + ': </span><span class="stamp-metadata-value">' + formattedValue + '</span></div>'            
        }, '');

    return `<div class="stamp-metadata">${html}</div>`;
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

    return validFields.reduce((acc: { [key: string]: any }, fieldName) => {
        acc[fieldName] = hit.metadata[fieldName];
        return acc;
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
    return Object.keys(sourceMetadata).reduce((acc: {[key: string]: string}, fieldName) => {
        acc[fieldName] = formatMetadata(fieldName, sourceMetadata[fieldName]);
        return acc;
    }, {});
};

const togglePanel = () => {
    const selectedHits = getSelection();

    document.querySelector('body').classList.remove('no-stamps');
    document.querySelector('body').classList.remove('no-selection');
    document.querySelector('body').classList.remove('stamps-panel');

    if (stampHits && Object.keys(stampHits).length > 0 && selectedHits && selectedHits.length > 0) {
        return document.querySelector('body').classList.add('stamps-panel');       
    }

    if (!stampHits || Object.keys(stampHits).length == 0) {
        return document.querySelector('body').classList.add('no-stamps');
    }

    document.querySelector('body').classList.add('no-selection');
};

(async () => {
    contextService = await AssetsPluginContext.get('http://localhost:9000');
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