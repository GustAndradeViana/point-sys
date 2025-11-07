import { Request, Response } from 'express';
import { Advantage } from '../models/Advantage';
import { Company } from '../models/Company';
import { AuthenticatedRequest } from '../middleware/auth';

export class AdvantageController {
  private advantageModel = new Advantage();
  private companyModel = new Company();

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

