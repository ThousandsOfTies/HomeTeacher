import { useState, useEffect } from 'react';
import { PDFFileRecord } from '../utils/indexedDB';
import { getPlatformInfo } from '../utils/storageManager';
import GradingHistory from './grading/GradingHistory';
import { usePDFRecords } from '../hooks/admin/usePDFRecords';
import { useSNSLinks } from '../hooks/admin/useSNSLinks';
import { useStorage } from '../hooks/admin/useStorage';
import './AdminPanel.css';
import { PREDEFINED_SNS, getSNSIcon } from '../constants/sns';

interface AdminPanelProps {
  onSelectPDF: (record: PDFFileRecord) => void;
}

export default function AdminPanel({ onSelectPDF }: AdminPanelProps) {
  // Custom hooks
  const {
    pdfRecords,
    loading,
    uploading,
    errorMessage: pdfError,
    setErrorMessage: setPdfError,
    loadPDFRecords,
    handleFileSelect,
    handleDeleteRecord
  } = usePDFRecords();

  const {
    snsLinks,
    selectedSNS,
    customUrls,
    loadSNSLinks,
    toggleSNS,
    updateCustomUrl,
    saveSNSSettings: saveSNSSettingsHook
  } = useSNSLinks();

  const {
    storageInfo,
    initializeStorage
  } = useStorage();

  // Local UI state
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; fileName: string } | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showSNSSettings, setShowSNSSettings] = useState(false);
  const [showGradingHistory, setShowGradingHistory] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showStorageInfo, setShowStorageInfo] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadPDFRecords();
    loadSNSLinks();
    initializeStorage();
  }, []);

  // ストレージをクリアする（確認なし、自動更新）
  const clearAllStorage = async () => {
    try {
      // IndexedDBを削除
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase('HomeTeacherDB');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error('データベースの削除に失敗しました'));
      });

      // データを再読み込み（空になる）
      await loadPDFRecords();
      await loadSNSLinks();

      // ストレージ情報ダイアログを閉じる
      setShowStorageInfo(false);
    } catch (error) {
      console.error('ストレージのクリアに失敗:', error);
      setErrorMessage('ストレージのクリアに失敗しました: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  // 削除を確定
  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    await handleDeleteRecord(deleteConfirm.id);
    setDeleteConfirm(null);
  };

  // SNS設定を保存
  const saveSNSSettings = async () => {
    try {
      await saveSNSSettingsHook();
      setShowSNSSettings(false);
    } catch (error) {
      console.error('Failed to save SNS settings:', error);
      setErrorMessage('Failed to save SNS settings');
    }
  };

  // Merge error messages
  const currentError = errorMessage || pdfError;

  if (loading) {
    return (
      <div className="admin-container">
        <div className="loading-container">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {uploading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          color: 'white',
          fontSize: '20px',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div style={{ fontSize: '48px' }}>⏳</div>
          <div>Loading PDF...</div>
          <div style={{ fontSize: '14px', color: '#ccc' }}>Please wait</div>
        </div>
      )}

      {deleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#2c3e50', fontSize: '20px' }}>
              Confirm Delete
            </h3>
            <p style={{ margin: '0 0 24px 0', color: '#7f8c8d', fontSize: '14px' }}>
              <strong>{deleteConfirm.fileName}</strong><br />
              Delete this PDF and all drawings?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showSNSSettings && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '600px',
            maxHeight: '80vh',
            width: '90%',
            overflow: 'auto'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#2c3e50', fontSize: '20px' }}>
              Enjoy Links Settings
            </h3>
            <p style={{ margin: '0 0 20px 0', color: '#7f8c8d', fontSize: '14px' }}>
              Select which links to show on the grading result screen
            </p>

            <div style={{ marginBottom: '24px' }}>
              {PREDEFINED_SNS.map((sns) => {
                const isSelected = selectedSNS.has(sns.id);
                const customUrl = customUrls[sns.id] || '';
                const snsIcon = getSNSIcon(sns.id);
                const iconColor = snsIcon?.color || '#3498db';

                return (
                  <div key={sns.id} style={{
                    marginBottom: '16px',
                    padding: '12px',
                    border: `2px solid ${isSelected ? iconColor : '#e0e0e0'}`,
                    borderRadius: '8px',
                    backgroundColor: isSelected ? '#f0f8ff' : 'white',
                    transition: 'all 0.2s ease'
                  }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSNS(sns.id)}
                        style={{
                          width: '20px',
                          height: '20px',
                          cursor: 'pointer'
                        }}
                      />
                      {snsIcon ? (
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          dangerouslySetInnerHTML={{ __html: snsIcon.svg }}
                        />
                      ) : (
                        <span style={{ fontSize: '24px' }}>{sns.icon}</span>
                      )}
                      <span style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#2c3e50',
                        flex: 1
                      }}>
                        {sns.name}
                      </span>
                    </label>
                    {isSelected && (
                      <div style={{ marginTop: '12px', marginLeft: '44px' }}>
                        <label style={{
                          display: 'block',
                          marginBottom: '6px',
                          color: '#7f8c8d',
                          fontSize: '12px'
                        }}>
                          Custom URL (optional - leave blank for default)
                        </label>
                        <input
                          type="url"
                          value={customUrl}
                          onChange={(e) => updateCustomUrl(sns.id, e.target.value)}
                          placeholder={sns.defaultUrl}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '6px',
                            fontSize: '13px',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowSNSSettings(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveSNSSettings}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showHelp && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#2c3e50', fontSize: '20px' }}>
              How to Use
            </h3>
            <ul style={{ margin: '0 0 24px 0', color: '#7f8c8d', fontSize: '14px', lineHeight: '1.8' }}>
              <li>Click on a PDF to open it</li>
              <li>Click the <strong>+ PDF</strong> button to add a new file</li>
              <li>Click the trash icon to delete a file</li>
            </ul>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowHelp(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {showStorageInfo && storageInfo && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#2c3e50', fontSize: '20px' }}>
              💾 Storage Information
            </h3>

            <div style={{ marginBottom: '20px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
                fontSize: '14px',
                color: '#7f8c8d'
              }}>
                <span>Usage:</span>
                <span style={{ fontWeight: '600', color: '#2c3e50' }}>
                  {storageInfo.usageMB.toFixed(2)} MB / {storageInfo.quotaMB.toFixed(0)} MB
                </span>
              </div>

              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#ecf0f1',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${Math.min(storageInfo.usagePercent, 100)}%`,
                  height: '100%',
                  backgroundColor: storageInfo.usagePercent > 80 ? '#e74c3c' : storageInfo.usagePercent > 50 ? '#f39c12' : '#27ae60',
                  transition: 'width 0.3s ease'
                }} />
              </div>

              <div style={{
                marginTop: '8px',
                fontSize: '12px',
                color: '#95a5a6',
                textAlign: 'right'
              }}>
                {storageInfo.usagePercent.toFixed(1)}% used
              </div>
            </div>

            <div style={{
              padding: '12px',
              backgroundColor: storageInfo.isPersisted ? '#d4edda' : '#fff3cd',
              border: `1px solid ${storageInfo.isPersisted ? '#c3e6cb' : '#ffeeba'}`,
              borderRadius: '6px',
              marginBottom: '20px'
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: storageInfo.isPersisted ? '#155724' : '#856404',
                marginBottom: '4px'
              }}>
                {storageInfo.isPersisted ? '✅ Protected' : '⚠️ Not Protected'}
              </div>
              <div style={{
                fontSize: '12px',
                color: storageInfo.isPersisted ? '#155724' : '#856404',
                lineHeight: '1.5'
              }}>
                {storageInfo.isPersisted
                  ? 'Your data is protected from automatic deletion.'
                  : getPlatformInfo().isIOS && !getPlatformInfo().isPWA
                    ? 'Add this app to your home screen to protect your data from automatic deletion after 7 days of inactivity.'
                    : 'Install this app or use it regularly to protect your data.'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <button
                onClick={clearAllStorage}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c0392b'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e74c3c'}
              >
                🗑️ すべて削除
              </button>
              <button
                onClick={() => setShowStorageInfo(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2980b9'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3498db'}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {currentError && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#e74c3c', fontSize: '20px' }}>
              Error
            </h3>
            <p style={{ margin: '0 0 24px 0', color: '#7f8c8d', fontSize: '14px' }}>
              {currentError}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setErrorMessage(null);
                  setPdfError(null);
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-container">
        <button className="help-button" onClick={() => setShowHelp(true)} title="Help">
          ?
        </button>
        {storageInfo && (
          <button
            className="help-button"
            onClick={() => setShowStorageInfo(true)}
            title="Storage Info"
            style={{ left: '20px', right: 'auto' }}
          >
            💾
          </button>
        )}
        <button
          className="help-button"
          onClick={() => setShowGradingHistory(true)}
          title="採点履歴を表示"
          style={{ right: '70px' }}
        >
          🕒
        </button>
        <div className="admin-header">
          <h1 className="admin-title">Welcome to Home Teacher</h1>
        </div>

      <div className="two-column-layout">
        {/* PDF Section */}
        <div className="pdf-section">
          <h2 className="section-title">PDF Files</h2>

          {pdfRecords.length === 0 ? (
            <div className="empty-state">
              <p>No PDF files yet</p>
            </div>
          ) : (
            <div className="pdf-list">
              {pdfRecords.map((record) => (
                <div
                  key={record.id}
                  className="pdf-list-item"
                  onClick={() => onSelectPDF(record)}
                >
                  <div className="icon-container">
                    {record.thumbnail ? (
                      <img
                        src={record.thumbnail}
                        alt={record.fileName}
                        style={{
                          width: '48px',
                          height: '64px',
                          objectFit: 'cover',
                          borderRadius: '4px',
                          border: '1px solid #ddd'
                        }}
                      />
                    ) : (
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#e74c3c"
                        strokeWidth="2"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                    )}
                  </div>
                  <div className="file-name">{record.fileName}</div>
                  <button
                    className="delete-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm({ id: record.id, fileName: record.fileName });
                    }}
                    title="削除"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <button className="add-button" onClick={() => handleFileSelect(onSelectPDF)}>
            <span className="add-button-icon">+</span>
            <span>Add PDF</span>
          </button>
        </div>

        {/* SNS Links Section */}
        <div className="sns-section">
          <h2 className="section-title">Enjoy Links</h2>

          {snsLinks.length > 0 ? (
            <div className="sns-list">
              {snsLinks.map((link) => {
                const snsIcon = getSNSIcon(link.id);
                const iconColor = snsIcon?.color || '#3498db';

                return (
                  <div
                    key={link.id}
                    className="sns-list-item"
                    style={{
                      borderColor: iconColor
                    }}
                  >
                    {snsIcon ? (
                      <div
                        className="sns-icon"
                        dangerouslySetInnerHTML={{ __html: snsIcon.svg }}
                      />
                    ) : (
                      <span style={{ fontSize: '24px' }}>{link.icon}</span>
                    )}
                    <span className="sns-name">{link.name}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <p>No links configured</p>
            </div>
          )}

          <button
            className="add-button"
            onClick={() => setShowSNSSettings(true)}
            style={{ backgroundColor: '#27ae60' }}
          >
            <span className="add-button-icon">⚙</span>
            <span>Settings</span>
          </button>
        </div>
      </div>
      </div>

      {/* 採点履歴モーダル */}
      {showGradingHistory && (
        <GradingHistory
          onClose={() => setShowGradingHistory(false)}
        />
      )}
    </>
  );
}
