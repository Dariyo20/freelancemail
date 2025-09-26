const convertToHtml = (text) => {
    return text
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/^/, '<div style="font-family: Arial, sans-serif;"><p>')
        .replace(/$/, '</p></div>');
};