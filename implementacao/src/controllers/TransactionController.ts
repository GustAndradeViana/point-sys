import { Request, Response } from 'express';
import { Transaction } from '../models/Transaction';
import { User } from '../models/User';
import { sendMail } from '../utils/mailer';

export class TransactionController {
  private transactionModel = new Transaction();
  private userModel = new User();

  public async getBalance(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const balance = await this.transactionModel.getBalance(userId);

      res.json({ balance });
    } catch (error) {
      console.error('Erro ao buscar saldo:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  public async getTransactions(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const transactions = await this.transactionModel.findByUserId(userId);

      res.json({ transactions });
    } catch (error) {
      console.error('Erro ao buscar transações:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  public async sendCoins(req: Request, res: Response): Promise<void> {
    try {
      const fromUserId = (req as any).user.id;
      const { to_email, amount, reason } = req.body;

      if (!to_email || !amount || !reason) {
        res.status(400).json({ error: 'Email do destinatário, valor e motivo são obrigatórios' });
        return;
      }

      if (amount <= 0) {
        res.status(400).json({ error: 'Valor deve ser positivo' });
        return;
      }

      const sender = await this.userModel.findById(fromUserId);
      if (!sender) {
        res.status(404).json({ error: 'Usuário remetente não encontrado' });
        return;
      }

      if (sender.type !== 'professor') {
        res.status(403).json({ error: 'Apenas professores podem enviar moedas' });
        return;
      }

      const toUser = await this.userModel.findByEmail(to_email);
      if (!toUser) {
        res.status(404).json({ error: 'Usuário destinatário não encontrado' });
        return;
      }

      if (toUser.type !== 'student') {
        res.status(400).json({ error: 'Moedas só podem ser enviadas para alunos' });
        return;
      }

      const senderBalance = await this.transactionModel.getBalance(fromUserId);
      if (senderBalance < amount) {
        res.status(400).json({ error: 'Saldo insuficiente' });
        return;
      }

      const transaction = await this.transactionModel.create({
        from_user_id: fromUserId,
        to_user_id: toUser.id,
        amount,
        reason,
        transaction_type: 'transfer'
      });

      try {
        await sendMail({
          to: toUser.email,
          subject: 'Você recebeu moedas no Sistema de Mérito Acadêmico',
          text: `Você recebeu ${amount} moedas do professor ${sender.email}.\n\nMotivo: ${reason}`
        });
      } catch (mailError) {
        console.error('Erro ao enviar email de notificação:', mailError);
      }

      res.status(201).json({
        message: 'Moedas enviadas com sucesso',
        transaction: {
          id: transaction.id,
          amount: transaction.amount,
          reason: transaction.reason,
          created_at: transaction.created_at
        }
      });
    } catch (error) {
      console.error('Erro ao enviar moedas:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
}
