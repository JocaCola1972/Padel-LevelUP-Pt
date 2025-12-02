
import React, { useState, useEffect, useRef } from 'react';
import { Player } from '../types';
import { getPlayers, savePlayer, savePlayersBulk, removePlayer, generateUUID } from '../services/storageService';
import { Button } from './Button';

// Declaration for SheetJS loaded via CDN
declare const XLSX: any;

interface MembersListProps {
    currentUser?: Player;
}

export const MembersList: React.FC<MembersListProps> = ({ currentUser }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Manual Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  // Delete Confirmation Modal State
  const [playerToDelete, setPlayerToDelete] = useState<Player | null>(null);
  
  // File Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState('');

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = () => {
    const data = getPlayers();
    // Sort by Participant Number
    setPlayers(data.sort((a, b) => (a.participantNumber || 0) - (b.participantNumber || 0)));
  };

  const filteredPlayers = players.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.phone.includes(searchTerm) ||
    p.participantNumber.toString().includes(searchTerm)
  );

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || newPhone.length < 9) {
        alert("Preencha o nome e um telemóvel válido.");
        return;
    }

    const newPlayer: Player = {
        id: generateUUID(),
        name: newName,
        phone: newPhone,
        totalPoints: 0,
        gamesPlayed: 0,
        participantNumber: 0 // Assigned in savePlayer
    };

    savePlayer(newPlayer);
    setNewName('');
    setNewPhone('');
    setIsAddModalOpen(false);
    loadPlayers();
  };

  const confirmDelete = () => {
      if (playerToDelete) {
          removePlayer(playerToDelete.id);
          loadPlayers();
          setPlayerToDelete(null);
      }
  };

  // Export Function
  const exportMembers = () => {
      if (filteredPlayers.length === 0) {
          alert("Sem membros para exportar.");
          return;
      }
      
      const data = filteredPlayers.map(p => ({
          'ID': p.participantNumber,
          'Nome': p.name,
          'Telemóvel': p.phone,
          'Jogos': p.gamesPlayed,
          'Pontos': p.totalPoints,
          'Função': p.role || 'user'
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Membros");
      XLSX.writeFile(wb, `LevelUp_Membros.xlsx`);
  };

  const downloadTemplate = () => {
      const ws = XLSX.utils.json_to_sheet([
          { "Nome": "João Silva", "Telemóvel": "912345678" },
          { "Nome": "Maria Santos", "Telemóvel": "961234567" }
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      XLSX.writeFile(wb, "Template_Importacao_LevelUp.xlsx");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus('A ler ficheiro...');
    
    const reader = new FileReader();
    
    reader.onload = (evt) => {
        try {
            const data = evt.target?.result;
            if (!data) return;

            // Using SheetJS to parse
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // Array of arrays

            if (jsonData.length < 1) {
                setImportStatus('Ficheiro vazio.');
                return;
            }

            const rows = jsonData as any[][];
            let nameIdx = 0;
            let phoneIdx = 1;
            let startRow = 1; // Default skip header row (index 0)

            // 1. Detect Headers
            // Try to find headers in the first row
            const headerRow = rows[0].map((c: any) => String(c).toLowerCase().trim());
            const foundNameIdx = headerRow.findIndex((h: string) => h.includes('nome') || h.includes('name') || h.includes('jogador') || h.includes('participante'));
            const foundPhoneIdx = headerRow.findIndex((h: string) => h.includes('telem') || h.includes('phone') || h.includes('contac') || h.includes('celular') || h.includes('movel'));

            if (foundNameIdx > -1) {
                // Headers found!
                nameIdx = foundNameIdx;
                // Try to find phone, or assume it's next to name
                phoneIdx = foundPhoneIdx > -1 ? foundPhoneIdx : (nameIdx + 1);
            } else {
                // No headers found? Use Default: Col A (0) = Name, Col B (1) = Phone
                nameIdx = 0;
                phoneIdx = 1;
                
                // Heuristic: If row 0, col 1 looks like a phone number, assume NO header exists and start at row 0
                const potentialPhone = rows[0][1] ? String(rows[0][1]).replace(/[^0-9]/g, '') : '';
                if (potentialPhone.length >= 9) {
                    startRow = 0;
                }
            }

            const playersToImport: Partial<Player>[] = [];

            for (let i = startRow; i < rows.length; i++) {
                const row = rows[i];
                if (!row || !row[nameIdx]) continue;

                const rawName = String(row[nameIdx]).trim();
                let rawPhone = row[phoneIdx] ? String(row[phoneIdx]).trim() : '';
                
                // Clean phone
                rawPhone = rawPhone.replace(/[^0-9]/g, '');

                // Simple validation: Name exists and phone has at least 9 digits
                if (rawName && rawPhone.length >= 9) {
                    playersToImport.push({
                        name: rawName,
                        phone: rawPhone
                    });
                }
            }

            if (playersToImport.length > 0) {
                const result = savePlayersBulk(playersToImport);
                setImportStatus(`Importação concluída: ${result.added} novos, ${result.updated} atualizados.`);
                loadPlayers();
            } else {
                setImportStatus('Nenhum jogador válido encontrado no ficheiro. Verifique se tem colunas "Nome" e "Telemóvel".');
            }

        } catch (error) {
            console.error(error);
            setImportStatus('Erro ao processar ficheiro. Verifique o formato.');
        } finally {
            // Reset input so same file can be selected again if needed
            if (fileInputRef.current) fileInputRef.current.value = '';
            setTimeout(() => setImportStatus(''), 5000);
        }
    };

    // Read as binary string for XLSX compatibility
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Header & Actions */}
      <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-padel-blue">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-gray-800">👥 Membros LevelUp</h2>
                <p className="text-sm text-gray-500">Diretório de todos os jogadores registados.</p>
            </div>
            
            {currentUser?.role === 'admin' && (
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <Button onClick={() => setIsAddModalOpen(true)}>
                        + Novo Membro
                    </Button>
                    
                    <div className="relative">
                        <input 
                            type="file" 
                            accept=".xlsx, .xls, .csv" 
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                            📥 Importar
                        </Button>
                    </div>

                     <Button variant="ghost" onClick={exportMembers} className="border border-gray-200">
                        📤 Exportar
                    </Button>
                </div>
            )}
        </div>

        {/* Template Helper Link (Only for Admin) */}
        {currentUser?.role === 'admin' && (
            <div className="mt-2 text-right">
                <button 
                    onClick={downloadTemplate}
                    className="text-xs text-blue-500 hover:text-blue-700 underline"
                >
                    Descarregar Modelo (Template) de Importação
                </button>
            </div>
        )}

        {/* Import Status Message */}
        {importStatus && (
            <div className={`mt-4 p-3 rounded-lg text-sm font-semibold animate-fade-in border ${importStatus.includes('Erro') || importStatus.includes('Nenhum') ? 'bg-red-50 text-red-800 border-red-100' : 'bg-blue-50 text-blue-800 border-blue-100'}`}>
                {importStatus}
            </div>
        )}

        {/* Search Bar */}
        <div className="mt-6">
            <input 
                type="text" 
                placeholder="Pesquisar por nome, número de telemóvel ou ID..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-padel-blue outline-none"
            />
        </div>
      </div>

      {/* Manual Add Modal */}
      {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
                  <h3 className="text-xl font-bold mb-4">Adicionar Novo Membro</h3>
                  <form onSubmit={handleManualAdd} className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1">Nome Completo</label>
                          <input 
                            type="text" 
                            className="w-full p-2 border rounded"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            required
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1">Telemóvel</label>
                          <input 
                            type="tel" 
                            className="w-full p-2 border rounded"
                            value={newPhone}
                            onChange={e => setNewPhone(e.target.value)}
                            required
                          />
                      </div>
                      <div className="flex gap-2 pt-2">
                          <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)} className="flex-1">Cancelar</Button>
                          <Button type="submit" className="flex-1">Gravar</Button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Delete Confirmation Modal */}
      {playerToDelete && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm border-t-4 border-red-500">
                  <div className="flex flex-col items-center text-center mb-6">
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 text-3xl">
                          ⚠️
                      </div>
                      <h3 className="text-xl font-bold text-gray-800">Eliminar Membro?</h3>
                      <p className="text-lg font-semibold text-gray-800 mt-2">{playerToDelete.name}</p>
                      <p className="text-sm text-gray-500 mt-4">
                          Esta ação é <span className="font-bold text-red-600 uppercase">irreversível</span>.
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                          A ficha do jogador será apagada e todas as inscrições futuras serão canceladas automaticamente.
                      </p>
                  </div>
                  
                  <div className="flex gap-3">
                      <Button 
                        variant="secondary" 
                        onClick={() => setPlayerToDelete(null)} 
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button 
                        variant="danger" 
                        onClick={confirmDelete} 
                        className="flex-1"
                      >
                        Eliminar Definitivamente
                      </Button>
                  </div>
              </div>
          </div>
      )}

      {/* Members List */}
      <div className="bg-white/95 backdrop-blur rounded-xl shadow overflow-hidden border border-white/20">
        <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase flex justify-between">
            <span>Total: {filteredPlayers.length} membros</span>
        </div>
        <div className="divide-y divide-gray-100">
            {filteredPlayers.map(player => (
                <div key={player.id} className="p-4 hover:bg-gray-50 flex items-center justify-between group transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-padel-blue/10 border border-padel-blue/20 overflow-hidden flex-shrink-0">
                            {player.photoUrl ? (
                                <img src={player.photoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center font-bold text-padel-blue text-xs">
                                    #{player.participantNumber}
                                </div>
                            )}
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900">{player.name}</h4>
                            <p className="text-xs text-gray-500 font-mono">#{player.participantNumber} • {player.phone}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <div className="text-xs text-gray-400">Jogos: <span className="text-gray-600 font-bold">{player.gamesPlayed}</span></div>
                            <div className="text-xs text-gray-400">Pts: <span className="text-padel-dark font-bold">{player.totalPoints}</span></div>
                        </div>
                        {currentUser?.role === 'admin' && (
                            <button 
                                onClick={() => setPlayerToDelete(player)}
                                className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                                title="Apagar Membro"
                            >
                                🗑️
                            </button>
                        )}
                    </div>
                </div>
            ))}
            {filteredPlayers.length === 0 && (
                <div className="p-8 text-center text-gray-400">
                    Nenhum membro encontrado.
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
