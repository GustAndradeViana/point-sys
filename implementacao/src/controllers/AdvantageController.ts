import { Request, Response } from 'express';
import { Advantage } from '../models/Advantage';
import { Company } from '../models/Company';
import { Student } from '../models/Student';
import { Transaction } from '../models/Transaction';
import { Redemption } from '../models/Redemption';
import { AuthenticatedRequest } from '../middleware/auth';
import { sendMail } from '../utils/mailer';

export class AdvantageController {
  private advantageModel = new Advantage();
  private companyModel = new Company();
  private studentModel = new Student();
  private transactionModel = new Transaction();
  private redemptionModel = new Redemption();

  // CREATE - Criar nova vantagem (apenas para empresas parceiras)
  public async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { title, description, image_url, cost_coins } = req.body;

      // Validações
      if (!title || !description || !cost_coins) {
        res.status(400).json({ error: 'Campos obrigatórios: title, description, cost_coins' });
        return;
      }

      if (cost_coins <= 0) {
        res.status(400).json({ error: 'O custo em moedas deve ser maior que zero' });
        return;
      }

      // Verificar se o usuário é uma empresa
      if (req.user.type !== 'company') {
        res.status(403).json({ error: 'Apenas empresas parceiras podem cadastrar vantagens' });
        return;
      }

      // Buscar empresa pelo user_id
      const company = await this.companyModel.findByUserId(req.user.id);
      if (!company) {
        res.status(404).json({ error: 'Empresa não encontrada' });
        return;
      }

      // Criar vantagem
      const advantageData = {
        company_id: company.id,
        title,
        description,
        image_url: image_url || null,
        cost_coins: parseInt(cost_coins),
        is_active: true
      };

      const advantage = await this.advantageModel.create(advantageData);

      res.status(201).json({
        message: 'Vantagem cadastrada com sucesso',
        advantage: {
          id: advantage.id,
          company_id: advantage.company_id,
          title: advantage.title,
          description: advantage.description,
          image_url: advantage.image_url,
          cost_coins: advantage.cost_coins,
          is_active: advantage.is_active,
          created_at: advantage.created_at
        }
      });
    } catch (error) {
      console.error('Erro ao criar vantagem:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  // READ - Listar todas as vantagens (público - para alunos)
  public async findAll(req: Request, res: Response): Promise<void> {
    try {
      const advantages = await this.advantageModel.findActive();
      res.json({ advantages });
    } catch (error) {
      console.error('Erro ao listar vantagens:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  // READ - Listar vantagens de uma empresa específica
  public async findByCompany(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Verificar se o usuário é uma empresa
      if (req.user.type !== 'company') {
        res.status(403).json({ error: 'Apenas empresas parceiras podem visualizar suas vantagens' });
        return;
      }

      // Buscar empresa pelo user_id
      const company = await this.companyModel.findByUserId(req.user.id);
      if (!company) {
        res.status(404).json({ error: 'Empresa não encontrada' });
        return;
      }

      const advantages = await this.advantageModel.findByCompanyId(company.id);
      res.json({ advantages });
    } catch (error) {
      console.error('Erro ao listar vantagens da empresa:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  // STUDENT - Resgatar vantagem
  public async redeem(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const advantageId = parseInt(id);

      if (isNaN(advantageId)) {
        res.status(400).json({ error: 'ID inválido' });
        return;
      }

      if (req.user.type !== 'student') {
        res.status(403).json({ error: 'Apenas alunos podem resgatar vantagens' });
        return;
      }

      const advantage = await this.advantageModel.findById(advantageId);
      if (!advantage) {
        res.status(404).json({ error: 'Vantagem não encontrada' });
        return;
      }

      if (!advantage.is_active) {
        res.status(400).json({ error: 'Vantagem inativa' });
        return;
      }

      // Buscar aluno pelo user_id
      const student = await this.studentModel.findByUserId(req.user.id);
      if (!student) {
        res.status(404).json({ error: 'Aluno não encontrado' });
        return;
      }

      // Verificar se já existe resgate desta vantagem para este aluno (pendente ou concluído)
      const existingRedemption = await this.redemptionModel.findByStudentAndAdvantage(student.id, advantageId);
      if (existingRedemption && existingRedemption.status !== 'cancelled') {
        res.status(400).json({ error: 'Esta vantagem já foi resgatada por este aluno' });
        return;
      }

      // Verificar saldo do aluno
      const studentBalance = await this.transactionModel.getBalance(req.user.id);
      if (studentBalance < advantage.cost_coins) {
        res.status(400).json({ error: 'Saldo insuficiente para resgatar esta vantagem' });
        return;
      }

      // Buscar empresa dona da vantagem
      const company = await this.companyModel.findById(advantage.company_id);
      if (!company) {
        res.status(404).json({ error: 'Empresa parceira não encontrada para esta vantagem' });
        return;
      }

      // Criar transação de resgate (do aluno para a empresa)
      const transaction = await this.transactionModel.create({
        from_user_id: req.user.id,
        to_user_id: company.user_id,
        amount: advantage.cost_coins,
        reason: `Resgate da vantagem: ${advantage.title}`,
        transaction_type: 'redemption'
      });

      // Gerar código de resgate
      const redemptionCode = `RDM-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .substring(2, 6)
        .toUpperCase()}`;

      // Registrar resgate
      const redemption = await this.redemptionModel.create({
        student_id: student.id,
        advantage_id: advantage.id,
        transaction_id: transaction.id,
        redemption_code: redemptionCode,
        status: 'pending'
      });

      // Enviar emails com o cupom (aluno e empresa)
      const studentEmail = req.user.email;
      const companyEmail = company.email || (company as any).user_email;

      const emailText = `Cupom de resgate - Sistema de Mérito Acadêmico

Vantagem: ${advantage.title}
Empresa: ${company.name}
Valor em moedas: ${advantage.cost_coins}

Código do resgate: ${redemptionCode}

Apresente este código no momento da utilização da vantagem.`;

      try {
        if (studentEmail) {
          await sendMail({
            to: studentEmail,
            subject: 'Cupom de vantagem resgatada',
            text: emailText
          });
        }

        if (companyEmail) {
          await sendMail({
            to: companyEmail,
            subject: 'Aluno resgatou uma vantagem',
            text: emailText
          });
        }
      } catch (mailError) {
        console.log('mailError', mailError);
      }

      res.status(201).json({
        message: 'Vantagem resgatada com sucesso',
        redemption: {
          id: redemption.id,
          redemption_code: redemption.redemption_code,
          status: redemption.status,
          created_at: redemption.created_at
        },
        transaction: {
          id: transaction.id,
          amount: transaction.amount,
          created_at: transaction.created_at
        }
      });
    } catch (error) {
      console.error('Erro ao resgatar vantagem:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  // STUDENT - Listar resgates do aluno logado
  public async getStudentRedemptions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.user.type !== 'student') {
        res.status(403).json({ error: 'Apenas alunos podem visualizar seus resgates' });
        return;
      }

      const student = await this.studentModel.findByUserId(req.user.id);
      if (!student) {
        res.status(404).json({ error: 'Aluno não encontrado' });
        return;
      }

      const redemptions = await this.redemptionModel.findByStudentId(student.id);
      res.json({ redemptions });
    } catch (error) {
      console.error('Erro ao listar resgates do aluno:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  // READ - Buscar vantagem por ID
  public async findById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const advantageId = parseInt(id);

      if (isNaN(advantageId)) {
        res.status(400).json({ error: 'ID inválido' });
        return;
      }

      const advantage = await this.advantageModel.findById(advantageId);
      if (!advantage) {
        res.status(404).json({ error: 'Vantagem não encontrada' });
        return;
      }

      res.json({ advantage });
    } catch (error) {
      console.error('Erro ao buscar vantagem:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  // UPDATE - Atualizar vantagem (apenas a empresa dona)
  public async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const advantageId = parseInt(id);
      const updateData = req.body;

      if (isNaN(advantageId)) {
        res.status(400).json({ error: 'ID inválido' });
        return;
      }

      // Verificar se o usuário é uma empresa
      if (req.user.type !== 'company') {
        res.status(403).json({ error: 'Apenas empresas parceiras podem atualizar vantagens' });
        return;
      }

      // Verificar se vantagem existe
      const existingAdvantage = await this.advantageModel.findById(advantageId);
      if (!existingAdvantage) {
        res.status(404).json({ error: 'Vantagem não encontrada' });
        return;
      }

      // Buscar empresa pelo user_id
      const company = await this.companyModel.findByUserId(req.user.id);
      if (!company) {
        res.status(404).json({ error: 'Empresa não encontrada' });
        return;
      }

      // Verificar se a vantagem pertence à empresa
      if (existingAdvantage.company_id !== company.id) {
        res.status(403).json({ error: 'Você não tem permissão para atualizar esta vantagem' });
        return;
      }

      // Validar cost_coins se fornecido
      if (updateData.cost_coins !== undefined && updateData.cost_coins <= 0) {
        res.status(400).json({ error: 'O custo em moedas deve ser maior que zero' });
        return;
      }

      const success = await this.advantageModel.update(advantageId, updateData);
      if (!success) {
        res.status(400).json({ error: 'Erro ao atualizar vantagem' });
        return;
      }

      // Buscar vantagem atualizada
      const updatedAdvantage = await this.advantageModel.findById(advantageId);
      res.json({
        message: 'Vantagem atualizada com sucesso',
        advantage: updatedAdvantage
      });
    } catch (error) {
      console.error('Erro ao atualizar vantagem:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  // DELETE - Deletar vantagem (apenas a empresa dona)
  public async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const advantageId = parseInt(id);

      if (isNaN(advantageId)) {
        res.status(400).json({ error: 'ID inválido' });
        return;
      }

      // Verificar se o usuário é uma empresa
      if (req.user.type !== 'company') {
        res.status(403).json({ error: 'Apenas empresas parceiras podem deletar vantagens' });
        return;
      }

      // Verificar se vantagem existe
      const existingAdvantage = await this.advantageModel.findById(advantageId);
      if (!existingAdvantage) {
        res.status(404).json({ error: 'Vantagem não encontrada' });
        return;
      }

      // Buscar empresa pelo user_id
      const company = await this.companyModel.findByUserId(req.user.id);
      if (!company) {
        res.status(404).json({ error: 'Empresa não encontrada' });
        return;
      }

      // Verificar se a vantagem pertence à empresa
      if (existingAdvantage.company_id !== company.id) {
        res.status(403).json({ error: 'Você não tem permissão para deletar esta vantagem' });
        return;
      }

      const success = await this.advantageModel.delete(advantageId);
      if (!success) {
        res.status(400).json({ error: 'Erro ao deletar vantagem' });
        return;
      }

      res.json({ message: 'Vantagem deletada com sucesso' });
    } catch (error) {
      console.error('Erro ao deletar vantagem:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  // TOGGLE - Ativar/Desativar vantagem (apenas a empresa dona)
  public async toggleActive(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const advantageId = parseInt(id);

      if (isNaN(advantageId)) {
        res.status(400).json({ error: 'ID inválido' });
        return;
      }

      // Verificar se o usuário é uma empresa
      if (req.user.type !== 'company') {
        res.status(403).json({ error: 'Apenas empresas parceiras podem alterar o status de vantagens' });
        return;
      }

      // Verificar se vantagem existe
      const existingAdvantage = await this.advantageModel.findById(advantageId);
      if (!existingAdvantage) {
        res.status(404).json({ error: 'Vantagem não encontrada' });
        return;
      }

      // Buscar empresa pelo user_id
      const company = await this.companyModel.findByUserId(req.user.id);
      if (!company) {
        res.status(404).json({ error: 'Empresa não encontrada' });
        return;
      }

      // Verificar se a vantagem pertence à empresa
      if (existingAdvantage.company_id !== company.id) {
        res.status(403).json({ error: 'Você não tem permissão para alterar o status desta vantagem' });
        return;
      }

      const success = await this.advantageModel.toggleActive(advantageId);
      if (!success) {
        res.status(400).json({ error: 'Erro ao alterar status da vantagem' });
        return;
      }

      // Buscar vantagem atualizada
      const updatedAdvantage = await this.advantageModel.findById(advantageId);
      res.json({
        message: `Vantagem ${updatedAdvantage.is_active ? 'ativada' : 'desativada'} com sucesso`,
        advantage: updatedAdvantage
      });
    } catch (error) {
      console.error('Erro ao alterar status da vantagem:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  // Métodos DEMO - Para demonstração sem autenticação
  // Em produção, estes métodos devem ser removidos ou protegidos

  public async createDemo(req: Request, res: Response): Promise<void> {
    try {
      const { title, description, image_url, cost_coins, company_id } = req.body;

      // Validações
      if (!title || !description || !cost_coins) {
        res.status(400).json({ error: 'Campos obrigatórios: title, description, cost_coins' });
        return;
      }

      if (cost_coins <= 0) {
        res.status(400).json({ error: 'O custo em moedas deve ser maior que zero' });
        return;
      }

      // Para demonstração, usar company_id fornecido ou primeira empresa disponível
      let finalCompanyId = company_id;
      if (!finalCompanyId) {
        const companies = await this.companyModel.findAll();
        if (companies.length === 0) {
          res.status(400).json({ error: 'Nenhuma empresa cadastrada. Cadastre uma empresa primeiro.' });
          return;
        }
        finalCompanyId = companies[0].id;
      }

      // Verificar se empresa existe
      const company = await this.companyModel.findById(finalCompanyId);
      if (!company) {
        res.status(404).json({ error: 'Empresa não encontrada' });
        return;
      }

      // Criar vantagem
      const advantageData = {
        company_id: finalCompanyId,
        title,
        description,
        image_url: image_url || null,
        cost_coins: parseInt(cost_coins),
        is_active: true
      };

      const advantage = await this.advantageModel.create(advantageData);

      res.status(201).json({
        message: 'Vantagem cadastrada com sucesso',
        advantage: {
          id: advantage.id,
          company_id: advantage.company_id,
          title: advantage.title,
          description: advantage.description,
          image_url: advantage.image_url,
          cost_coins: advantage.cost_coins,
          is_active: advantage.is_active,
          created_at: advantage.created_at
        }
      });
    } catch (error) {
      console.error('Erro ao criar vantagem (demo):', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  public async updateDemo(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const advantageId = parseInt(id);
      const updateData = req.body;

      if (isNaN(advantageId)) {
        res.status(400).json({ error: 'ID inválido' });
        return;
      }

      // Verificar se vantagem existe
      const existingAdvantage = await this.advantageModel.findById(advantageId);
      if (!existingAdvantage) {
        res.status(404).json({ error: 'Vantagem não encontrada' });
        return;
      }

      // Validar cost_coins se fornecido
      if (updateData.cost_coins !== undefined && updateData.cost_coins <= 0) {
        res.status(400).json({ error: 'O custo em moedas deve ser maior que zero' });
        return;
      }

      const success = await this.advantageModel.update(advantageId, updateData);
      if (!success) {
        res.status(400).json({ error: 'Erro ao atualizar vantagem' });
        return;
      }

      // Buscar vantagem atualizada
      const updatedAdvantage = await this.advantageModel.findById(advantageId);
      res.json({
        message: 'Vantagem atualizada com sucesso',
        advantage: updatedAdvantage
      });
    } catch (error) {
      console.error('Erro ao atualizar vantagem (demo):', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  public async toggleActiveDemo(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const advantageId = parseInt(id);

      if (isNaN(advantageId)) {
        res.status(400).json({ error: 'ID inválido' });
        return;
      }

      // Verificar se vantagem existe
      const existingAdvantage = await this.advantageModel.findById(advantageId);
      if (!existingAdvantage) {
        res.status(404).json({ error: 'Vantagem não encontrada' });
        return;
      }

      const success = await this.advantageModel.toggleActive(advantageId);
      if (!success) {
        res.status(400).json({ error: 'Erro ao alterar status da vantagem' });
        return;
      }

      // Buscar vantagem atualizada
      const updatedAdvantage = await this.advantageModel.findById(advantageId);
      res.json({
        message: `Vantagem ${updatedAdvantage.is_active ? 'ativada' : 'desativada'} com sucesso`,
        advantage: updatedAdvantage
      });
    } catch (error) {
      console.error('Erro ao alterar status da vantagem (demo):', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  public async deleteDemo(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const advantageId = parseInt(id);

      if (isNaN(advantageId)) {
        res.status(400).json({ error: 'ID inválido' });
        return;
      }

      // Verificar se vantagem existe
      const existingAdvantage = await this.advantageModel.findById(advantageId);
      if (!existingAdvantage) {
        res.status(404).json({ error: 'Vantagem não encontrada' });
        return;
      }

      const success = await this.advantageModel.delete(advantageId);
      if (!success) {
        res.status(400).json({ error: 'Erro ao deletar vantagem' });
        return;
      }

      res.json({ message: 'Vantagem deletada com sucesso' });
    } catch (error) {
      console.error('Erro ao deletar vantagem (demo):', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
}

