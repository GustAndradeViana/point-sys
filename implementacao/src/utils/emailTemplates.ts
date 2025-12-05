export interface CouponEmailData {
  redemptionCode: string;
  advantageTitle: string;
  companyName: string;
  costCoins: number;
  studentName?: string;
  createdAt: string;
}

export function generateCouponEmailHTML(data: CouponEmailData, isForStudent: boolean): string {
  const date = new Date(data.createdAt).toLocaleString('pt-BR');
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cupom de Resgate - Sistema de Mérito Acadêmico</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .container {
            background-color: #ffffff;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #4CAF50;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #4CAF50;
            margin: 0;
            font-size: 24px;
        }
        .coupon-code {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            margin: 30px 0;
            font-size: 28px;
            font-weight: bold;
            letter-spacing: 3px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .info-section {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e0e0e0;
        }
        .info-row:last-child {
            border-bottom: none;
        }
        .info-label {
            font-weight: bold;
            color: #666;
        }
        .info-value {
            color: #333;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            color: #666;
            font-size: 12px;
        }
        .warning {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .coins-badge {
            display: inline-block;
            background-color: #FFD700;
            color: #333;
            padding: 5px 10px;
            border-radius: 20px;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Cupom de Resgate</h1>
            <p>Sistema de Mérito Acadêmico</p>
        </div>
        
        ${isForStudent ? `
        <p>Olá${data.studentName ? `, ${data.studentName}` : ''}!</p>
        <p>Parabéns! Você resgatou uma vantagem com sucesso. Apresente o código abaixo no momento da utilização.</p>
        ` : `
        <p>Olá, ${data.companyName}!</p>
        <p>Um aluno resgatou uma de suas vantagens. Confira os detalhes abaixo.</p>
        `}
        
        <div class="coupon-code">
            ${data.redemptionCode}
        </div>
        
        <div class="info-section">
            <div class="info-row">
                <span class="info-label">Vantagem:</span>
                <span class="info-value">${data.advantageTitle}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Empresa:</span>
                <span class="info-value">${data.companyName}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Valor em moedas:</span>
                <span class="info-value"><span class="coins-badge">${data.costCoins} moedas</span></span>
            </div>
            <div class="info-row">
                <span class="info-label">Data do resgate:</span>
                <span class="info-value">${date}</span>
            </div>
        </div>
        
        ${isForStudent ? `
        <div class="warning">
            <strong>⚠️ Importante:</strong> Apresente este código no momento da utilização da vantagem. Guarde este email para referência.
        </div>
        ` : `
        <div class="warning">
            <strong>⚠️ Importante:</strong> Verifique este código quando o aluno apresentar para utilizar a vantagem.
        </div>
        `}
        
        <div class="footer">
            <p>Este é um email automático do Sistema de Mérito Acadêmico.</p>
            <p>Por favor, não responda a este email.</p>
        </div>
    </div>
</body>
</html>
  `;
}

export function generateCouponEmailText(data: CouponEmailData, isForStudent: boolean): string {
  const date = new Date(data.createdAt).toLocaleString('pt-BR');
  
  const greeting = isForStudent 
    ? `Olá${data.studentName ? `, ${data.studentName}` : ''}!`
    : `Olá, ${data.companyName}!`;
    
  const intro = isForStudent
    ? 'Parabéns! Você resgatou uma vantagem com sucesso. Apresente o código abaixo no momento da utilização.'
    : 'Um aluno resgatou uma de suas vantagens. Confira os detalhes abaixo.';
  
  return `
Cupom de Resgate - Sistema de Mérito Acadêmico

${greeting}

${intro}

═══════════════════════════════════════
CÓDIGO DO CUPOM: ${data.redemptionCode}
═══════════════════════════════════════

Detalhes do Resgate:
- Vantagem: ${data.advantageTitle}
- Empresa: ${data.companyName}
- Valor em moedas: ${data.costCoins}
- Data do resgate: ${date}

${isForStudent 
  ? 'IMPORTANTE: Apresente este código no momento da utilização da vantagem. Guarde este email para referência.'
  : 'IMPORTANTE: Verifique este código quando o aluno apresentar para utilizar a vantagem.'
}

---
Este é um email automático do Sistema de Mérito Acadêmico.
Por favor, não responda a este email.
  `.trim();
}

