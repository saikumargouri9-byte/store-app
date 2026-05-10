const e = {
    parameter: {
        'TotalValueOfOrder': '55.55',
        'EmpID': '123'
    },
    parameters: {
        'TotalValueOfOrder': ['55.55'],
        'EmpID': ['123', '123']
    }
};

const allParams = e.parameters;
const i = 0;

const headers = ['TotalValueOfOrder', 'Total Value of Order', 'TotalValue Of Order'];

headers.forEach(h => {
    const key = String(h).replace(/\s+/g, '');
    const keyLower = key.toLowerCase();
    
    const getVal = (paramKey) => {
        const arr = allParams[paramKey];
        if (arr && arr.length > i) return arr[i];
        return e.parameter[paramKey] || '';
    };

    let result;
    if (keyLower === 'totalvalueoforder') {
        result = getVal('TotalValueOfOrder') || getVal(key) || getVal(h);
    } else {
        result = getVal(key) || getVal(h);
    }
    
    console.log(`Header: "${h}", result: "${result}"`);
});
