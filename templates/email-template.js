const createCustomizedPitch = (company, analysis) => {
    const problems = analysis.problems.filter(p => 
        !p.includes('analysis failed') && !p.includes('error') && !p.includes('timeout')
    ).slice(0, 3);
    
    const firstName = company['First Name'];
    let pitch = `Hi ${firstName},\n\n`;
    
    pitch += `I reviewed ${company['Company Name']}'s website and noticed some technical areas that could be improved:\n\n`;
    
    if (problems.length > 0) {
        problems.forEach((problem, index) => {
            const cleanProblem = problem.replace(/^(slow|missing|no|poor|bad)/i, (match) => {
                const improvements = {
                    'slow': 'Optimize',
                    'missing': 'Add',
                    'no': 'Implement',
                    'poor': 'Improve',
                    'bad': 'Fix'
                };
                return improvements[match.toLowerCase()] || match;
            });
            
            pitch += `${index + 1}. ${cleanProblem}\n`;
        });
        pitch += '\n';
    }
    
    pitch += `I'm a Full Stack Developer, and I'd be happy to discuss these findings in more detail.\n\n`;
    pitch += `Would you be interested in a brief conversation about improving your website's performance?\n\n`;
    
    pitch += `Best regards,\n`;
    pitch += `David Ariyo\n`;
    pitch += `Full Stack Developer`;

    return pitch;
};