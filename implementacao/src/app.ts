import express from 'express';
import cors from 'cors';
import path from 'path';
import { DatabaseManager } from './database/DatabaseManager';

import authRoutes from './routes/auth';
import transactionRoutes from './routes/transactions';
import studentRoutes from './routes/students';
import companyRoutes from './routes/companies';
import advantageRoutes from './routes/advantages';

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializar o banco de dados
const dbManager = DatabaseManager.getInstance();

// Configuração do CORS - permitir origens específicas incluindo Live Server
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        'http://localhost:8080',
        'http://127.0.0.1:8080'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware adicional para CORS com Live Server
app.use((req, res, next) => {
    const origin = req.headers.origin;
    console.log('Origin da requisição:', origin);
    
    // Permitir origens do Live Server e localhost
    if (origin && (
        origin.includes('localhost:5500') || 
        origin.includes('127.0.0.1:5500') ||
        origin.includes('localhost:3000') ||
        origin.includes('127.0.0.1:3000')
    )) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    }
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    next();
});

app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/advantages', advantageRoutes);

app.get('/api/health', (req, res) => {
  res.json({ 
    message: 'Sistema de Mérito Acadêmico funcionando!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Endpoint para limpar banco de dados (apenas para desenvolvimento)
app.delete('/api/clear-database', (req, res) => {
  try {
    const db = DatabaseManager.getInstance().getDb();
    
    // Limpar todas as tabelas
    db.exec(`
      DELETE FROM redemptions;
      DELETE FROM advantages;
      DELETE FROM transactions;
      DELETE FROM students;
      DELETE FROM professors;
      DELETE FROM companies;
      DELETE FROM users;
    `, (err) => {
      if (err) {
        console.error('Erro ao limpar banco:', err);
        res.status(500).json({ error: 'Erro ao limpar banco de dados' });
      } else {
        console.log('Banco de dados limpo com sucesso');
        res.json({ message: 'Banco de dados limpo com sucesso' });
      }
    });
  } catch (error) {
    console.error('Erro ao limpar banco:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint de teste para CORS
app.options('/api/test-cors', (req, res) => {
  res.status(200).end();
});

app.get('/api/test-cors', (req, res) => {
  res.json({ 
    message: 'CORS funcionando!',
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
});

// Endpoint para visualizar todos os dados do banco
app.get('/api/database-dump', async (req, res) => {
  try {
    const db = DatabaseManager.getInstance().getDb();
    const data: any = {};
    
    // Função para executar query e retornar dados
    const getTableData = (tableName: string): Promise<any[]> => {
      return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM ${tableName}`, (err, rows) => {
          if (err) {
            console.error(`Erro ao buscar dados da tabela ${tableName}:`, err);
            resolve([]);
          } else {
            resolve(rows || []);
          }
        });
      });
    };
    
    // Buscar dados de todas as tabelas
    data.institutions = await getTableData('institutions');
    data.users = await getTableData('users');
    data.students = await getTableData('students');
    data.companies = await getTableData('companies');
    data.professors = await getTableData('professors');
    data.transactions = await getTableData('transactions');
    data.advantages = await getTableData('advantages');
    data.redemptions = await getTableData('redemptions');
    
    res.json({
      message: 'Dados do banco de dados',
      timestamp: new Date().toISOString(),
      data
    });
  } catch (error) {
    console.error('Erro ao buscar dados do banco:', error);
    res.status(500).json({ error: 'Erro ao buscar dados do banco' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Erro:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Aguardar inicialização do banco antes de iniciar o servidor
dbManager.waitForInitialization().then(() => {
  app.listen(PORT, () => {
    console.log('Servidor rodando na porta', PORT);
    console.log('Banco SQLite em memória inicializado');
    console.log('Acesse: http://localhost:' + PORT);
  });
}).catch((err) => {
  console.error('Erro ao inicializar banco de dados:', err);
  process.exit(1);
});

export default app;
