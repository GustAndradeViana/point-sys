// Sistema de Pontos - Frontend com Backend Integration
// Gerenciamento de Alunos e Empresas com API REST

class PointSystem {
    constructor() {
        this.baseURL = 'http://localhost:3000/api';
        this.students = [];
        this.companies = [];
        this.advantages = [];
        this.studentAdvantages = [];
        this.studentRedemptions = [];
        this.transactions = [];
        this.balance = 0;
        this.currentStudentId = null;
        this.currentCompanyId = null;
        this.currentAdvantageId = null;
        this.deleteCallback = null;
        this.authToken = localStorage.getItem('authToken');
        this.currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        
        // Verificar se há usuário logado
        if (this.authToken && this.currentUser) {
            this.showMainApp();
        } else {
            this.showLoginScreen();
        }
    }

    showLoginScreen() {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }

    showMainApp() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        
        this.setupUserInterface();
        this.loadUserData();
    }

    setupUserInterface() {
        if (!this.currentUser) return;

        const userType = this.currentUser.type;
        const userEmail = this.currentUser.email;
        
        // Atualizar mensagem de boas-vindas
        const welcomeText = document.getElementById('userWelcome');
        if (welcomeText) {
            welcomeText.textContent = `Bem-vindo, ${userEmail} (${this.getUserTypeLabel(userType)})`;
        }

        // Esconder todas as navegações
        document.getElementById('adminNav').style.display = 'none';
        document.getElementById('studentNav').style.display = 'none';
        document.getElementById('companyNav').style.display = 'none';
        const professorNav = document.getElementById('professorNav');
        if (professorNav) {
            professorNav.style.display = 'none';
        }

        // Esconder todas as seções
        document.querySelectorAll('.content-section').forEach(section => {
            section.style.display = 'none';
        });

        // Mostrar navegação e seção apropriada
        if (userType === 'admin') {
            document.getElementById('adminNav').style.display = 'flex';
            document.getElementById('admin-students').style.display = 'block';
            this.setupTabNavigation();
        } else if (userType === 'student') {
            document.getElementById('studentNav').style.display = 'flex';
            document.getElementById('student-advantages').style.display = 'block';
            this.setupTabNavigation();
        } else if (userType === 'company') {
            document.getElementById('companyNav').style.display = 'flex';
            document.getElementById('company-advantages').style.display = 'block';
            this.setupTabNavigation();
        } else if (userType === 'professor') {
            if (professorNav) {
                professorNav.style.display = 'flex';
            }
            const sendSection = document.getElementById('professor-send-coins');
            if (sendSection) {
                sendSection.style.display = 'block';
            }
            this.setupTabNavigation();
        }
    }

    getUserTypeLabel(type) {
        const labels = {
            'admin': 'Administrador',
            'student': 'Aluno',
            'company': 'Empresa Parceira',
            'professor': 'Professor'
        };
        return labels[type] || type;
    }

    loadUserData() {
        if (!this.currentUser) return;

        const userType = this.currentUser.type;
        
        if (userType === 'admin') {
            this.loadStudents();
            this.loadCompanies();
        } else if (userType === 'student') {
            this.loadStudentAdvantages();
        } else if (userType === 'company') {
            this.loadAdvantages();
        } else if (userType === 'professor') {
            this.loadProfessorAccount();
        }
    }

    async loadAccountData(balanceElementId, transactionsBodyId) {
        const tbody = document.getElementById(transactionsBodyId);
        const balanceElement = document.getElementById(balanceElementId);

        if (!tbody) {
            return;
        }

        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px;">
                    <div class="loading"></div>
                    <p style="margin-top: 10px; color: #718096;">Carregando extrato...</p>
                </td>
            </tr>
        `;

        try {
            const balanceResponse = await this.makeRequest('/transactions/balance', 'GET', null, true);
            const transactionsResponse = await this.makeRequest('/transactions', 'GET', null, true);

            this.balance = balanceResponse.balance || 0;
            this.transactions = transactionsResponse.transactions || [];

            if (balanceElement) {
                balanceElement.textContent = `${this.balance} moedas`;
            }

            const professorBalanceSend = document.getElementById('professorBalanceSend');
            if (professorBalanceSend && balanceElementId === 'professorBalance') {
                professorBalanceSend.textContent = `${this.balance} moedas`;
            }

            const currentUserId = this.currentUser ? this.currentUser.id : null;

            if (this.transactions.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="empty-state">
                            <i class="fas fa-receipt"></i>
                            <h3>Nenhuma transação encontrada</h3>
                            <p>As transações aparecerão aqui assim que forem realizadas.</p>
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = this.transactions.map(tx => {
                const date = new Date(tx.created_at).toLocaleString('pt-BR');
                let typeLabel = 'Transferência';
                if (tx.transaction_type === 'semester_credit') {
                    typeLabel = 'Crédito Semestral';
                } else if (tx.transaction_type === 'redemption') {
                    typeLabel = 'Resgate de Vantagem';
                }

                const isIncoming = currentUserId && tx.to_user_id === currentUserId;
                const valorPrefix = isIncoming ? '+' : '-';
                const badgeClass = isIncoming ? 'status-active' : 'status-inactive';

                let description = '';
                if (tx.transaction_type === 'transfer') {
                    description = isIncoming ? 'Moedas recebidas' : 'Moedas enviadas';
                    if (tx.reason) {
                        description += ` - ${tx.reason}`;
                    }
                } else if (tx.transaction_type === 'semester_credit') {
                    description = 'Crédito semestral de moedas';
                } else if (tx.transaction_type === 'redemption') {
                    description = 'Resgate de vantagem';
                }

                const otherEmail = isIncoming ? (tx.from_email || '-') : (tx.to_email || '-');

                return `
                    <tr>
                        <td>${date}</td>
                        <td>${typeLabel}</td>
                        <td>${description}</td>
                        <td>
                            <span class="status-badge ${badgeClass}">
                                ${valorPrefix} ${tx.amount} moedas
                            </span>
                        </td>
                        <td>${otherEmail}</td>
                    </tr>
                `;
            }).join('');
        } catch (error) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Erro ao carregar extrato</h3>
                        <p>Verifique a conexão com o servidor</p>
                    </td>
                </tr>
            `;
        }
    }

    async loadStudentAccount() {
        await this.loadAccountData('studentBalance', 'studentTransactionsBody');
    }

    async loadProfessorAccount() {
        await this.loadAccountData('professorBalance', 'professorTransactionsBody');
    }

    async loadProfessorStudents() {
        const container = document.getElementById('professorStudentsContainer');
        if (!container) return;

        container.innerHTML = `
            <div style="text-align: center; padding: 40px; width: 100%;">
                <div class="loading"></div>
                <p style="margin-top: 10px; color: #718096;">Carregando alunos...</p>
            </div>
        `;

        try {
            const { students } = await this.makeRequest('/transactions/professor/students-with-redemptions', 'GET', null, true);
            console.log('loadProfessorStudents_students', students);

            if (!students || students.length === 0) {
                container.innerHTML = `
                    <div class="empty-state" style="width: 100%;">
                        <i class="fas fa-user-graduate"></i>
                        <h3>Nenhum aluno encontrado</h3>
                        <p>Você ainda não enviou moedas para nenhum aluno.</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = students.map(studentData => {
                const redemptionsHtml = studentData.redemptions.length > 0
                    ? `
                        <div class="redemptions-section">
                            <h4><i class="fas fa-ticket-alt"></i> Cupons Resgatados (${studentData.redemptions.length})</h4>
                            <div class="redemptions-list">
                                ${studentData.redemptions.map(redemption => {
                                    const date = new Date(redemption.created_at).toLocaleString('pt-BR');
                                    const statusClass = redemption.status === 'completed' ? 'status-active' : 
                                                       redemption.status === 'cancelled' ? 'status-inactive' : 'status-pending';
                                    const statusLabel = redemption.status === 'completed' ? 'Utilizado' :
                                                       redemption.status === 'cancelled' ? 'Cancelado' : 'Pendente';
                                    
                                    return `
                                        <div class="redemption-item">
                                            <div class="redemption-code">
                                                <i class="fas fa-ticket-alt"></i>
                                                <strong>${redemption.redemption_code}</strong>
                                            </div>
                                            <div class="redemption-info">
                                                <span>${redemption.advantage?.title || 'Vantagem'}</span>
                                                <span class="status-badge ${statusClass}">${statusLabel}</span>
                                            </div>
                                            <div class="redemption-details">
                                                <span><i class="fas fa-building"></i> ${redemption.company?.name || 'Empresa'}</span>
                                                <span><i class="fas fa-coins"></i> ${redemption.advantage?.cost_coins || 0} moedas</span>
                                                <span><i class="fas fa-calendar"></i> ${date}</span>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `
                    : `
                        <div class="no-redemptions">
                            <i class="fas fa-info-circle"></i>
                            <p>Este aluno ainda não resgatou nenhuma vantagem.</p>
                        </div>
                    `;

                return `
                    <div class="student-card">
                        <div class="student-header">
                            <div class="student-info">
                                <h3><i class="fas fa-user-graduate"></i> ${studentData.student.name}</h3>
                                <p class="student-email"><i class="fas fa-envelope"></i> ${studentData.student.email}</p>
                                ${studentData.student.course ? `<p class="student-course"><i class="fas fa-book"></i> ${studentData.student.course}</p>` : ''}
                                ${studentData.student.institution_name ? `<p class="student-institution"><i class="fas fa-university"></i> ${studentData.student.institution_name}</p>` : ''}
                            </div>
                            <div class="student-stats">
                                <div class="stat-item">
                                    <span class="stat-label">Total Recebido</span>
                                    <span class="stat-value">${studentData.totalReceived} moedas</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Transações</span>
                                    <span class="stat-value">${studentData.transactions.length}</span>
                                </div>
                            </div>
                        </div>
                        <div class="student-transactions">
                            <h4><i class="fas fa-history"></i> Histórico de Moedas Enviadas</h4>
                            <div class="transactions-list">
                                ${studentData.transactions.map(tx => {
                                    const date = new Date(tx.created_at).toLocaleString('pt-BR');
                                    return `
                                        <div class="transaction-item">
                                            <div class="transaction-amount">
                                                <i class="fas fa-coins"></i>
                                                <strong>${tx.amount} moedas</strong>
                                            </div>
                                            <div class="transaction-reason">${tx.reason || 'Sem motivo especificado'}</div>
                                            <div class="transaction-date">${date}</div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                        ${redemptionsHtml}
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Erro ao carregar alunos:', error);
            container.innerHTML = `
                <div class="empty-state" style="width: 100%;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Erro ao carregar alunos</h3>
                    <p>Verifique a conexão com o servidor</p>
                </div>
            `;
        }
    }

    async sendCoins(sendData) {
        this.showLoading('Enviando moedas...');
        
        try {
            const payload = {
                to_email: sendData.to_email,
                amount: parseInt(sendData.amount, 10),
                reason: sendData.reason
            };

            const response = await this.makeRequest('/transactions/send', 'POST', payload, true);
            console.log('sendCoins_response', response);

            this.hideLoading();
            this.showToast('Moedas enviadas com sucesso!', 'success');

            await this.loadProfessorAccount();

            const sendCoinsForm = document.getElementById('sendCoinsForm');
            if (sendCoinsForm) {
                sendCoinsForm.reset();
            }
        } catch (error) {
            this.hideLoading();
        }
    }

    async redeemAdvantage(advantageId) {
        if (!this.currentUser || this.currentUser.type !== 'student') {
            this.showToast('Apenas alunos podem resgatar vantagens.', 'error');
            return;
        }

        this.showLoading('Resgatando vantagem...');

        try {
            const response = await this.makeRequest(`/advantages/${advantageId}/redeem`, 'POST', null, true);
            console.log('redeemAdvantage_response', response);

            this.hideLoading();

            const code = response?.redemption?.redemption_code;
            const message = code
                ? `Vantagem resgatada com sucesso! Código: ${code}`
                : 'Vantagem resgatada com sucesso!';

            this.showToast(message, 'success');

            // Atualizar lista de vantagens e extrato/saldo do aluno
            await this.loadStudentAdvantages();
            await this.loadStudentAccount();
        } catch (error) {
            this.hideLoading();
        }
    }

    async login(email, password) {
        try {
            const response = await this.makeRequest('/auth/login', 'POST', { email, password }, false);
            
            this.authToken = response.token;
            this.currentUser = response.user;
            
            localStorage.setItem('authToken', this.authToken);
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            
            this.showMainApp();
            this.showToast('Login realizado com sucesso!', 'success');
        } catch (error) {
            this.showToast('Erro ao fazer login. Verifique suas credenciais.', 'error');
            throw error;
        }
    }

    logout() {
        this.authToken = null;
        this.currentUser = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        this.showLoginScreen();
        this.showToast('Logout realizado com sucesso!', 'success');
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Modal close on outside click
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeAllModals();
            }
        });

        // Close modals with escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    setupTabNavigation() {
        const tabs = document.querySelectorAll('.nav-tab');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;
                this.switchTab(targetTab);
            });
        });
    }

    // API Helper Methods
    async makeRequest(endpoint, method = 'GET', data = null, requiresAuth = false) {
        const url = `${this.baseURL}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (requiresAuth && this.authToken) {
            options.headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        if (data) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            this.showToast(error.message || 'Erro na comunicação com o servidor', 'error');
            throw error;
        }
    }

    // Student Management
    async addStudent(studentData) {
        this.showLoading('Salvando aluno...');
        
        try {
            const studentPayload = {
                name: studentData.name,
                cpf: studentData.cpf,
                rg: studentData.rg || '',
                address: studentData.address || '',
                institution_id: parseInt(studentData.institution),
                course: studentData.course || '',
                email: studentData.email,
                password: 'temp123' // Temporary password
            };
            
            const response = await this.makeRequest('/students', 'POST', studentPayload);
            console.log('Student created:', response);
            
            // Reload students to get updated list
            await this.loadStudents();
            this.hideLoading();
            this.showToast('Aluno cadastrado com sucesso!', 'success');
            this.closeStudentModal();
        } catch (error) {
            this.hideLoading();
            this.showToast('Erro ao cadastrar aluno', 'error');
        }
    }

    async updateStudent(id, studentData) {
        this.showLoading('Atualizando aluno...');
        
        try {
            const studentPayload = {
                name: studentData.name,
                cpf: studentData.cpf,
                rg: studentData.rg || '',
                address: studentData.address || '',
                institution_id: parseInt(studentData.institution),
                course: studentData.course || ''
            };
            
            const student = await this.makeRequest(`/students/${id}`, 'PUT', studentPayload);
            
            const index = this.students.findIndex(s => s.id === id);
            if (index !== -1) {
                this.students[index] = student;
            }
            
            this.loadStudents();
            this.hideLoading();
            this.showToast('Aluno atualizado com sucesso!', 'success');
            this.closeStudentModal();
        } catch (error) {
            this.hideLoading();
            this.showToast('Erro ao atualizar aluno', 'error');
        }
    }

    async deleteStudent(id) {
        this.showLoading('Removendo aluno...');
        
        try {
            await this.makeRequest(`/students/${id}`, 'DELETE');
            
            const index = this.students.findIndex(s => s.id === id);
            if (index !== -1) {
                const student = this.students[index];
                this.students.splice(index, 1);
                this.loadStudents();
                this.hideLoading();
                this.showToast(`Aluno ${student.name} removido com sucesso!`, 'success');
            }
        } catch (error) {
            this.hideLoading();
            this.showToast('Erro ao remover aluno', 'error');
        }
    }

    async loadStudents() {
        const tbody = document.getElementById('studentsTableBody');
        if (!tbody) return;

        // Show loading briefly
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px;">
                    <div class="loading"></div>
                    <p style="margin-top: 10px; color: #718096;">Carregando alunos...</p>
                </td>
            </tr>
        `;

        try {
            const {students} = await this.makeRequest('/students');
            this.students = students;

            setTimeout(() => {
                if (this.students.length === 0) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="7" class="empty-state">
                                <i class="fas fa-user-graduate"></i>
                                <h3>Nenhum aluno cadastrado</h3>
                                <p>Clique em "Novo Aluno" para começar</p>
                            </td>
                        </tr>
                    `;
                    return;
                }

                tbody.innerHTML = this.students.map(student => `
                    <tr>
                        <td>${student.name}</td>
                        <td>${student.cpf}</td>
                        <td>${student.email || '-'}</td>
                        <td>${this.getInstitutionName(student.institution_id)}</td>
                        <td>${student.course || '-'}</td>
                        <td><span class="status-badge status-active">0 pts</span></td>
                        <td>
                            <div class="action-buttons">
                                <button class="action-btn btn-warning" onclick="editStudent(${student.id})" title="Editar">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="action-btn btn-danger" onclick="confirmDeleteStudent(${student.id})" title="Excluir">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            }, 500);
        } catch (error) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Erro ao carregar alunos</h3>
                        <p>Verifique a conexão com o servidor</p>
                    </td>
                </tr>
            `;
        }
    }

    // Company Management
    async addCompany(companyData) {
        this.showLoading('Salvando empresa...');
        
        try {
            const companyPayload = {
                name: companyData.name,
                cnpj: companyData.cnpj,
                description: companyData.description || '',
                address: companyData.address || '',
                phone: companyData.phone || '',
                email: companyData.email,
                website: companyData.website || '',
                is_active: companyData.is_active,
                password: 'temp123' // Temporary password
            };
            
            const response = await this.makeRequest('/companies', 'POST', companyPayload);
            console.log('Company created:', response);
            
            // Reload companies to get updated list
            await this.loadCompanies();
            this.hideLoading();
            this.showToast('Empresa cadastrada com sucesso!', 'success');
            this.closeCompanyModal();
        } catch (error) {
            this.hideLoading();
            this.showToast('Erro ao cadastrar empresa', 'error');
        }
    }

    async updateCompany(id, companyData) {
        this.showLoading('Atualizando empresa...');
        
        try {
            const companyPayload = {
                name: companyData.name,
                cnpj: companyData.cnpj,
                description: companyData.description || '',
                address: companyData.address || '',
                phone: companyData.phone || '',
                email: companyData.email,
                website: companyData.website || '',
                is_active: companyData.is_active
            };
            
            const company = await this.makeRequest(`/companies/${id}`, 'PUT', companyPayload);
            
            const index = this.companies.findIndex(c => c.id === id);
            if (index !== -1) {
                this.companies[index] = company;
            }
            
            this.loadCompanies();
            this.hideLoading();
            this.showToast('Empresa atualizada com sucesso!', 'success');
            this.closeCompanyModal();
        } catch (error) {
            this.hideLoading();
            this.showToast('Erro ao atualizar empresa', 'error');
        }
    }

    async deleteCompany(id) {
        this.showLoading('Removendo empresa...');
        
        try {
            await this.makeRequest(`/companies/${id}`, 'DELETE');
            
            const index = this.companies.findIndex(c => c.id === id);
            if (index !== -1) {
                const company = this.companies[index];
                this.companies.splice(index, 1);
                this.loadCompanies();
                this.hideLoading();
                this.showToast(`Empresa ${company.name} removida com sucesso!`, 'success');
            }
        } catch (error) {
            this.hideLoading();
            this.showToast('Erro ao remover empresa', 'error');
        }
    }

    async loadCompanies() {
        const tbody = document.getElementById('companiesTableBody');
        if (!tbody) return;

        // Show loading briefly
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px;">
                    <div class="loading"></div>
                    <p style="margin-top: 10px; color: #718096;">Carregando empresas...</p>
                </td>
            </tr>
        `;

        try {
            const {companies} = await this.makeRequest('/companies');
            this.companies = companies;

            setTimeout(() => {
                if (this.companies.length === 0) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="6" class="empty-state">
                                <i class="fas fa-building"></i>
                                <h3>Nenhuma empresa cadastrada</h3>
                                <p>Clique em "Nova Empresa" para começar</p>
                            </td>
                        </tr>
                    `;
                    return;
                }

                tbody.innerHTML = this.companies.map(company => `
                    <tr>
                        <td>${company.name}</td>
                        <td>${company.cnpj}</td>
                        <td>${company.email || '-'}</td>
                        <td>${company.phone || '-'}</td>
                        <td>
                            <span class="status-badge ${company.is_active ? 'status-active' : 'status-inactive'}">
                                ${company.is_active ? 'Ativa' : 'Inativa'}
                            </span>
                        </td>
                        <td>
                            <div class="action-buttons">
                                <button class="action-btn btn-warning" onclick="editCompany(${company.id})" title="Editar">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="action-btn ${company.is_active ? 'btn-secondary' : 'btn-success'}" 
                                        onclick="toggleCompanyStatus(${company.id})" 
                                        title="${company.is_active ? 'Desativar' : 'Ativar'}">
                                    <i class="fas fa-${company.is_active ? 'pause' : 'play'}"></i>
                                </button>
                                <button class="action-btn btn-danger" onclick="confirmDeleteCompany(${company.id})" title="Excluir">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            }, 500);
        } catch (error) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Erro ao carregar empresas</h3>
                        <p>Verifique a conexão com o servidor</p>
                    </td>
                </tr>
            `;
        }
    }

    async toggleCompanyStatus(id) {
        this.showLoading('Alterando status da empresa...');
        
        try {
            await this.makeRequest(`/companies/${id}/toggle`, 'PUT');
            
            // Reload companies to get updated data
            await this.loadCompanies();
            this.hideLoading();
            this.showToast('Status da empresa alterado com sucesso!', 'success');
        } catch (error) {
            this.hideLoading();
            this.showToast('Erro ao alterar status da empresa', 'error');
        }
    }

    // Advantage Management (Company)
    async addAdvantage(advantageData) {
        this.showLoading('Salvando vantagem...');
        
        try {
            const advantagePayload = {
                title: advantageData.title,
                description: advantageData.description,
                image_url: advantageData.image_url || null,
                cost_coins: parseInt(advantageData.cost_coins),
                is_active: advantageData.is_active
            };
            
            // Tentar usar rota autenticada primeiro
            let response;
            try {
                response = await this.makeRequest('/advantages', 'POST', advantagePayload, true);
            } catch (error) {
                // Se falhar, usar rota demo
                response = await this.makeRequest('/advantages/demo', 'POST', advantagePayload, false);
            }
            console.log('Advantage created:', response);
            
            await this.loadAdvantages();
            this.hideLoading();
            this.showToast('Vantagem cadastrada com sucesso!', 'success');
            this.closeAdvantageModal();
        } catch (error) {
            this.hideLoading();
            // Error message already shown by makeRequest
        }
    }

    async updateAdvantage(id, advantageData) {
        this.showLoading('Atualizando vantagem...');
        
        try {
            const advantagePayload = {
                title: advantageData.title,
                description: advantageData.description,
                image_url: advantageData.image_url || null,
                cost_coins: parseInt(advantageData.cost_coins),
                is_active: advantageData.is_active
            };
            
            // Tentar usar rota autenticada primeiro
            try {
                await this.makeRequest(`/advantages/${id}`, 'PUT', advantagePayload, true);
            } catch (error) {
                // Se falhar, usar rota demo
                await this.makeRequest(`/advantages/demo/${id}`, 'PUT', advantagePayload, false);
            }
            
            await this.loadAdvantages();
            this.hideLoading();
            this.showToast('Vantagem atualizada com sucesso!', 'success');
            this.closeAdvantageModal();
        } catch (error) {
            this.hideLoading();
            // Error message already shown by makeRequest
        }
    }

    async deleteAdvantage(id) {
        this.showLoading('Removendo vantagem...');
        
        try {
            // Tentar usar rota autenticada primeiro
            try {
                await this.makeRequest(`/advantages/${id}`, 'DELETE', null, true);
            } catch (error) {
                // Se falhar, usar rota demo
                await this.makeRequest(`/advantages/demo/${id}`, 'DELETE', null, false);
            }
            
            const index = this.advantages.findIndex(a => a.id === id);
            if (index !== -1) {
                const advantage = this.advantages[index];
                this.advantages.splice(index, 1);
                await this.loadAdvantages();
                this.hideLoading();
                this.showToast(`Vantagem "${advantage.title}" removida com sucesso!`, 'success');
            }
        } catch (error) {
            this.hideLoading();
            // Error message already shown by makeRequest
        }
    }

    async loadAdvantages() {
        const tbody = document.getElementById('advantagesTableBody');
        if (!tbody) return;

        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px;">
                    <div class="loading"></div>
                    <p style="margin-top: 10px; color: #718096;">Carregando vantagens...</p>
                </td>
            </tr>
        `;

        try {
            // Tentar usar rota autenticada primeiro, se falhar usar rota demo
            let advantages = [];
            try {
                const response = await this.makeRequest('/advantages/company/my-advantages', 'GET', null, true);
                advantages = response.advantages || [];
            } catch (error) {
                // Se falhar, usar rota pública (para demonstração)
                const response = await this.makeRequest('/advantages');
                advantages = response.advantages || [];
            }
            this.advantages = advantages;

            setTimeout(() => {
                if (this.advantages.length === 0) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="5" class="empty-state">
                                <i class="fas fa-gift"></i>
                                <h3>Nenhuma vantagem cadastrada</h3>
                                <p>Clique em "Nova Vantagem" para começar</p>
                            </td>
                        </tr>
                    `;
                    return;
                }

                tbody.innerHTML = this.advantages.map(advantage => `
                    <tr>
                        <td>${advantage.title}</td>
                        <td>${advantage.description.length > 50 ? advantage.description.substring(0, 50) + '...' : advantage.description}</td>
                        <td><span class="status-badge status-active">${advantage.cost_coins} moedas</span></td>
                        <td>
                            <span class="status-badge ${advantage.is_active ? 'status-active' : 'status-inactive'}">
                                ${advantage.is_active ? 'Ativa' : 'Inativa'}
                            </span>
                        </td>
                        <td>
                            <div class="action-buttons">
                                <button class="action-btn btn-warning" onclick="editAdvantage(${advantage.id})" title="Editar">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="action-btn ${advantage.is_active ? 'btn-secondary' : 'btn-success'}" 
                                        onclick="toggleAdvantageStatus(${advantage.id})" 
                                        title="${advantage.is_active ? 'Desativar' : 'Ativar'}">
                                    <i class="fas fa-${advantage.is_active ? 'pause' : 'play'}"></i>
                                </button>
                                <button class="action-btn btn-danger" onclick="confirmDeleteAdvantage(${advantage.id})" title="Excluir">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            }, 500);
        } catch (error) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Erro ao carregar vantagens</h3>
                        <p>Verifique a conexão com o servidor</p>
                    </td>
                </tr>
            `;
        }
    }

    async toggleAdvantageStatus(id) {
        this.showLoading('Alterando status da vantagem...');
        
        try {
            // Tentar usar rota autenticada primeiro
            try {
                await this.makeRequest(`/advantages/${id}/toggle`, 'PUT', null, true);
            } catch (error) {
                // Se falhar, usar rota demo
                await this.makeRequest(`/advantages/demo/${id}/toggle`, 'PUT', null, false);
            }
            
            await this.loadAdvantages();
            this.hideLoading();
            this.showToast('Status da vantagem alterado com sucesso!', 'success');
        } catch (error) {
            this.hideLoading();
            // Error message already shown by makeRequest
        }
    }

    // Student Advantages Management
    async loadStudentCoupons() {
        const container = document.getElementById('studentCouponsContainer');
        if (!container) return;

        container.innerHTML = `
            <div style="text-align: center; padding: 40px; width: 100%;">
                <div class="loading"></div>
                <p style="margin-top: 10px; color: #718096;">Carregando cupons...</p>
            </div>
        `;

        try {
            const { redemptions } = await this.makeRequest('/advantages/student/my-redemptions', 'GET', null, true);
            console.log('loadStudentCoupons_redemptions', redemptions);

            if (!redemptions || redemptions.length === 0) {
                container.innerHTML = `
                    <div class="empty-state" style="width: 100%;">
                        <i class="fas fa-ticket-alt"></i>
                        <h3>Nenhum cupom resgatado</h3>
                        <p>Você ainda não resgatou nenhuma vantagem. Explore as vantagens disponíveis!</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = redemptions.map(redemption => {
                const date = new Date(redemption.created_at).toLocaleString('pt-BR');
                const statusClass = redemption.status === 'completed' ? 'status-active' : 
                                   redemption.status === 'cancelled' ? 'status-inactive' : 'status-pending';
                const statusLabel = redemption.status === 'completed' ? 'Utilizado' :
                                   redemption.status === 'cancelled' ? 'Cancelado' : 'Pendente';

                return `
                    <div class="coupon-card">
                        <div class="coupon-header">
                            <div class="coupon-code-display">
                                <i class="fas fa-ticket-alt"></i>
                                <span class="coupon-code-text">${redemption.redemption_code}</span>
                            </div>
                            <span class="status-badge ${statusClass}">${statusLabel}</span>
                        </div>
                        <div class="coupon-body">
                            <h3>${redemption.advantage?.title || 'Vantagem não encontrada'}</h3>
                            <p class="coupon-description">${redemption.advantage?.description || ''}</p>
                            <div class="coupon-details">
                                <div class="coupon-detail-item">
                                    <i class="fas fa-building"></i>
                                    <span>${redemption.company?.name || 'Empresa não encontrada'}</span>
                                </div>
                                <div class="coupon-detail-item">
                                    <i class="fas fa-coins"></i>
                                    <span>${redemption.advantage?.cost_coins || 0} moedas</span>
                                </div>
                                <div class="coupon-detail-item">
                                    <i class="fas fa-calendar"></i>
                                    <span>${date}</span>
                                </div>
                            </div>
                        </div>
                        <div class="coupon-footer">
                            <p class="coupon-instruction">
                                <i class="fas fa-info-circle"></i>
                                Apresente este código no momento da utilização da vantagem
                            </p>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Erro ao carregar cupons:', error);
            container.innerHTML = `
                <div class="empty-state" style="width: 100%;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Erro ao carregar cupons</h3>
                    <p>Verifique a conexão com o servidor</p>
                </div>
            `;
        }
    }

    async loadStudentAdvantages() {
        const grid = document.getElementById('studentAdvantagesGrid');
        if (!grid) return;

        grid.innerHTML = `
            <div style="text-align: center; padding: 40px; width: 100%;">
                <div class="loading"></div>
                <p style="margin-top: 10px; color: #718096;">Carregando vantagens...</p>
            </div>
        `;

        try {
            const {advantages} = await this.makeRequest('/advantages');
            this.studentAdvantages = advantages;

            // Buscar resgates do aluno logado, se houver
            let redeemedIds = new Set();
            if (this.currentUser && this.currentUser.type === 'student') {
                try {
                    const {redemptions} = await this.makeRequest('/advantages/student/my-redemptions', 'GET', null, true);
                    this.studentRedemptions = redemptions || [];
                    redeemedIds = new Set(this.studentRedemptions.map(r => r.advantage_id));
                } catch (redemptionError) {
                    console.log('redemptionError', redemptionError);
                }
            }

            setTimeout(() => {
                if (this.studentAdvantages.length === 0) {
                    grid.innerHTML = `
                        <div class="empty-state" style="width: 100%;">
                            <i class="fas fa-store"></i>
                            <h3>Nenhuma vantagem disponível</h3>
                            <p>Não há vantagens cadastradas no momento</p>
                        </div>
                    `;
                    return;
                }

                grid.innerHTML = this.studentAdvantages.map(advantage => {
                    const isRedeemed = redeemedIds.has(advantage.id);

                    const actionButton = this.currentUser && this.currentUser.type === 'student'
                        ? `
                            <div class="advantage-card-actions">
                                <button 
                                    class="btn ${isRedeemed ? 'btn-secondary' : 'btn-primary'} btn-sm"
                                    ${isRedeemed ? 'disabled' : `onclick="redeemAdvantage(${advantage.id})"`}
                                >
                                    ${isRedeemed ? 'Já resgatada' : 'Resgatar'}
                                </button>
                            </div>
                        `
                        : '';

                    return `
                        <div class="advantage-card">
                            <div class="advantage-card-image">
                                ${advantage.image_url 
                                    ? `<img src="${advantage.image_url}" alt="${advantage.title}" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-gift\\'></i>'">`
                                    : `<i class="fas fa-gift"></i>`
                                }
                            </div>
                            <div class="advantage-card-body">
                                <h3 class="advantage-card-title">${advantage.title}</h3>
                                <p class="advantage-card-description">${advantage.description}</p>
                                <div class="advantage-card-footer">
                                    <div class="advantage-card-cost">
                                        <i class="fas fa-coins"></i>
                                        ${advantage.cost_coins}
                                    </div>
                                    <div class="advantage-card-company">
                                        ${advantage.company_name || 'Empresa Parceira'}
                                    </div>
                                </div>
                                ${actionButton}
                            </div>
                        </div>
                    `;
                }).join('');
            }, 500);
        } catch (error) {
            grid.innerHTML = `
                <div class="empty-state" style="width: 100%;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Erro ao carregar vantagens</h3>
                    <p>Verifique a conexão com o servidor</p>
                </div>
            `;
        }
    }

    // Utility Methods
    getInstitutionName(id) {
        const institutions = {
            1: 'Universidade Federal de Tecnologia',
            2: 'Instituto Tecnológico Nacional',
            3: 'Faculdade de Ciências Aplicadas'
        };
        return institutions[id] || 'Instituição não encontrada';
    }

    formatCpf(cpf) {
        return cpf.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }

    formatCnpj(cnpj) {
        return cnpj.replace(/\D/g, '').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }

    formatPhone(phone) {
        return phone.replace(/\D/g, '').replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }

    // Modal Management
    openStudentModal(studentId = null) {
        const modal = document.getElementById('studentModal');
        const title = document.getElementById('studentModalTitle');
        const form = document.getElementById('studentForm');
        
        this.currentStudentId = studentId;
        
        if (studentId) {
            title.textContent = 'Editar Aluno';
            const student = this.students.find(s => s.id === studentId);
            if (student) {
                document.getElementById('studentName').value = student.name;
                document.getElementById('studentCpf').value = student.cpf;
                document.getElementById('studentRg').value = student.rg || '';
                document.getElementById('studentEmail').value = student.email || '';
                document.getElementById('studentInstitution').value = student.institution_id;
                document.getElementById('studentCourse').value = student.course || '';
                document.getElementById('studentAddress').value = student.address || '';
            }
        } else {
            title.textContent = 'Novo Aluno';
            form.reset();
        }
        
        modal.style.display = 'block';
    }

    closeStudentModal() {
        document.getElementById('studentModal').style.display = 'none';
        this.currentStudentId = null;
    }

    openCompanyModal(companyId = null) {
        const modal = document.getElementById('companyModal');
        const title = document.getElementById('companyModalTitle');
        const form = document.getElementById('companyForm');
        
        this.currentCompanyId = companyId;
        
        if (companyId) {
            title.textContent = 'Editar Empresa';
            const company = this.companies.find(c => c.id === companyId);
            if (company) {
                document.getElementById('companyName').value = company.name;
                document.getElementById('companyCnpj').value = company.cnpj;
                document.getElementById('companyEmail').value = company.email || '';
                document.getElementById('companyPhone').value = company.phone || '';
                document.getElementById('companyWebsite').value = company.website || '';
                document.getElementById('companyDescription').value = company.description || '';
                document.getElementById('companyAddress').value = company.address || '';
                document.getElementById('companyActive').checked = company.is_active;
            }
        } else {
            title.textContent = 'Nova Empresa';
            form.reset();
        }
        
        modal.style.display = 'block';
    }

    closeCompanyModal() {
        document.getElementById('companyModal').style.display = 'none';
        this.currentCompanyId = null;
    }

    openAdvantageModal(advantageId = null) {
        const modal = document.getElementById('advantageModal');
        const title = document.getElementById('advantageModalTitle');
        const form = document.getElementById('advantageForm');
        
        this.currentAdvantageId = advantageId;
        
        if (advantageId) {
            title.textContent = 'Editar Vantagem';
            const advantage = this.advantages.find(a => a.id === advantageId);
            if (advantage) {
                document.getElementById('advantageTitle').value = advantage.title;
                document.getElementById('advantageDescription').value = advantage.description;
                document.getElementById('advantageImageUrl').value = advantage.image_url || '';
                document.getElementById('advantageCostCoins').value = advantage.cost_coins;
                document.getElementById('advantageActive').checked = advantage.is_active;
            }
        } else {
            title.textContent = 'Nova Vantagem';
            form.reset();
        }
        
        modal.style.display = 'block';
    }

    closeAdvantageModal() {
        document.getElementById('advantageModal').style.display = 'none';
        this.currentAdvantageId = null;
    }

    closeAllModals() {
        this.closeStudentModal();
        this.closeCompanyModal();
        this.closeAdvantageModal();
        this.closeConfirmModal();
    }

    // Confirmation Modal
    showConfirmModal(message, callback) {
        document.getElementById('confirmMessage').textContent = message;
        this.deleteCallback = callback;
        document.getElementById('confirmModal').style.display = 'block';
    }

    closeConfirmModal() {
        document.getElementById('confirmModal').style.display = 'none';
        this.deleteCallback = null;
    }

    confirmDelete() {
        if (this.deleteCallback) {
            this.deleteCallback();
        }
        this.closeConfirmModal();
    }

    // Search and Filter
    filterStudents() {
        const searchTerm = document.getElementById('studentSearch').value.toLowerCase();
        const rows = document.querySelectorAll('#studentsTableBody tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }

    filterCompanies() {
        const searchTerm = document.getElementById('companySearch').value.toLowerCase();
        const rows = document.querySelectorAll('#companiesTableBody tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }

    filterAdvantages() {
        const searchTerm = document.getElementById('advantageSearch').value.toLowerCase();
        const rows = document.querySelectorAll('#advantagesTableBody tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }

    filterStudentAdvantages() {
        const searchTerm = document.getElementById('studentAdvantageSearch').value.toLowerCase();
        const cards = document.querySelectorAll('.advantage-card');
        
        cards.forEach(card => {
            const text = card.textContent.toLowerCase();
            card.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }

    // Loading Management
    showLoading(message = 'Carregando...') {
        // Create loading overlay if it doesn't exist
        let loadingOverlay = document.getElementById('loadingOverlay');
        if (!loadingOverlay) {
            loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'loadingOverlay';
            loadingOverlay.innerHTML = `
                <div class="loading-content">
                    <div class="loading-spinner"></div>
                    <p class="loading-message">${message}</p>
                </div>
            `;
            document.body.appendChild(loadingOverlay);
        } else {
            loadingOverlay.querySelector('.loading-message').textContent = message;
            loadingOverlay.style.display = 'flex';
        }
    }

    hideLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }

    // Toast Notifications
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Tab Management
    switchTab(tabName) {
        // Remove active class from all tabs
        document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
        
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.style.display = 'none';
            section.classList.remove('active');
        });
        
        // Show selected tab and section
        const selectedTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (selectedTab) {
            selectedTab.classList.add('active');
        }
        
        const targetSection = document.getElementById(tabName);
        if (targetSection) {
            targetSection.style.display = 'block';
            targetSection.classList.add('active');
        }
        
        // Load data if needed
        if (tabName === 'company-advantages') {
            this.loadAdvantages();
        } else if (tabName === 'student-advantages') {
            this.loadStudentAdvantages();
        } else if (tabName === 'admin-students') {
            this.loadStudents();
        } else if (tabName === 'admin-companies') {
            this.loadCompanies();
        } else if (tabName === 'student-extract') {
            this.loadStudentAccount();
        } else if (tabName === 'student-coupons') {
            this.loadStudentCoupons();
        } else if (tabName === 'professor-send-coins' || tabName === 'professor-extract') {
            this.loadProfessorAccount();
        } else if (tabName === 'professor-students') {
            this.loadProfessorStudents();
        }
    }
}

// Initialize the application
const app = new PointSystem();

// Global functions for HTML onclick events
function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    app.login(email, password).catch(() => {
        // Error already handled in login method
    });
}

function handleLogout() {
    app.logout();
}

function openStudentModal() {
    app.openStudentModal();
}

function closeStudentModal() {
    app.closeStudentModal();
}

function openCompanyModal() {
    app.openCompanyModal();
}

function closeCompanyModal() {
    app.closeCompanyModal();
}

function saveStudent(event) {
    event.preventDefault();
    
    const formData = {
        name: document.getElementById('studentName').value,
        cpf: document.getElementById('studentCpf').value,
        rg: document.getElementById('studentRg').value,
        email: document.getElementById('studentEmail').value,
        institution: document.getElementById('studentInstitution').value,
        course: document.getElementById('studentCourse').value,
        address: document.getElementById('studentAddress').value
    };

    if (app.currentStudentId) {
        app.updateStudent(app.currentStudentId, formData);
    } else {
        app.addStudent(formData);
    }
}

function saveCompany(event) {
    event.preventDefault();
    
    const formData = {
        name: document.getElementById('companyName').value,
        cnpj: document.getElementById('companyCnpj').value,
        email: document.getElementById('companyEmail').value,
        phone: document.getElementById('companyPhone').value,
        website: document.getElementById('companyWebsite').value,
        description: document.getElementById('companyDescription').value,
        address: document.getElementById('companyAddress').value,
        is_active: document.getElementById('companyActive').checked
    };

    if (app.currentCompanyId) {
        app.updateCompany(app.currentCompanyId, formData);
    } else {
        app.addCompany(formData);
    }
}

function editStudent(id) {
    app.openStudentModal(id);
}

function editCompany(id) {
    app.openCompanyModal(id);
}

function confirmDeleteStudent(id) {
    const student = app.students.find(s => s.id === id);
    app.showConfirmModal(`Tem certeza que deseja excluir o aluno "${student.name}"?`, () => {
        app.deleteStudent(id);
    });
}

function confirmDeleteCompany(id) {
    const company = app.companies.find(c => c.id === id);
    app.showConfirmModal(`Tem certeza que deseja excluir a empresa "${company.name}"?`, () => {
        app.deleteCompany(id);
    });
}

function toggleCompanyStatus(id) {
    app.toggleCompanyStatus(id);
}

function closeConfirmModal() {
    app.closeConfirmModal();
}

function confirmDelete() {
    app.confirmDelete();
}

function filterStudents() {
    app.filterStudents();
}

function filterCompanies() {
    app.filterCompanies();
}

// Input formatting functions
function formatCpf(input) {
    input.value = app.formatCpf(input.value);
}

function formatCnpj(input) {
    input.value = app.formatCnpj(input.value);
}

function formatPhone(input) {
    input.value = app.formatPhone(input.value);
}

// Advantage functions
function openAdvantageModal() {
    app.openAdvantageModal();
}

function closeAdvantageModal() {
    app.closeAdvantageModal();
}

function saveAdvantage(event) {
    event.preventDefault();
    
    const formData = {
        title: document.getElementById('advantageTitle').value,
        description: document.getElementById('advantageDescription').value,
        image_url: document.getElementById('advantageImageUrl').value,
        cost_coins: document.getElementById('advantageCostCoins').value,
        is_active: document.getElementById('advantageActive').checked
    };

    if (app.currentAdvantageId) {
        app.updateAdvantage(app.currentAdvantageId, formData);
    } else {
        app.addAdvantage(formData);
    }
}

function editAdvantage(id) {
    app.openAdvantageModal(id);
}

function confirmDeleteAdvantage(id) {
    const advantage = app.advantages.find(a => a.id === id);
    app.showConfirmModal(`Tem certeza que deseja excluir a vantagem "${advantage.title}"?`, () => {
        app.deleteAdvantage(id);
    });
}

function toggleAdvantageStatus(id) {
    app.toggleAdvantageStatus(id);
}

function filterAdvantages() {
    app.filterAdvantages();
}

function filterStudentAdvantages() {
    app.filterStudentAdvantages();
}

function handleSendCoins(event) {
    event.preventDefault();

    const formData = {
        to_email: document.getElementById('sendCoinsStudentEmail').value,
        amount: document.getElementById('sendCoinsAmount').value,
        reason: document.getElementById('sendCoinsReason').value
    };

    app.sendCoins(formData);
}

function redeemAdvantage(id) {
    app.redeemAdvantage(id);
}