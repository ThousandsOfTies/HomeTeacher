import { useState, useEffect } from 'react';
import { getAllPDFRecords, deletePDFRecord, savePDFRecord, generatePDFId, PDFFileRecord, getAllSNSLinks, deleteSNSLink, saveSNSLink, SNSLinkRecord } from '../utils/indexedDB';
import { requestPersistentStorage, getStorageEstimate, getPlatformInfo, getStorageAdviceMessage } from '../utils/storageManager';
import GradingHistory from './grading/GradingHistory';
import './AdminPanel.css';
import { PREDEFINED_SNS, getSNSIcon } from '../constants/sns';

interface AdminPanelProps {
  onSelectPDF: (record: PDFFileRecord) => void;
}

export default function AdminPanel({ onSelectPDF }: AdminPanelProps) {
  const [pdfRecords, setPdfRecords] = useState<PDFFileRecord[]>([]);
  const [snsLinks, setSnsLinks] = useState<SNSLinkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; fileName: string } | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showSNSSettings, setShowSNSSettings] = useState(false);
  const [showGradingHistory, setShowGradingHistory] = useState(false);
  const [selectedSNS, setSelectedSNS] = useState<Set<string>>(new Set());
  const [customUrls, setCustomUrls] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<{
    isPersisted: boolean;
    usageMB: number;
    quotaMB: number;
    usagePercent: number;
  } | null>(null);
  const [showStorageInfo, setShowStorageInfo] = useState(false);

  // PDFレコードとSNSリンクを読み込む
  useEffect(() => {
    loadPDFRecords();
    loadSNSLinks();
    initializeStorage();
  }, []);

  // ストレージをクリアする
  const clearAllStorage = async () => {
    try {
      // まず状態をクリア
      setPdfRecords([]);
      setSnsLinks([]);
      setSelectedSNS(new Set());
      setCustomUrls({});

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

  // ストレージの初期化と永続化リクエスト
  const initializeStorage = async () => {
    try {
      // 永続化をリクエスト
      const isPersisted = await requestPersistentStorage();

      // ストレージ情報を取得
      const estimate = await getStorageEstimate();

      if (estimate) {
        setStorageInfo({
          isPersisted,
          usageMB: estimate.usageMB,
          quotaMB: estimate.quotaMB,
          usagePercent: estimate.usagePercent,
        });
      }

      // プラットフォーム情報を取得してアドバイスを表示
      const platformInfo = getPlatformInfo();
      const advice = getStorageAdviceMessage(isPersisted, platformInfo);

      // 重要な警告の場合は自動表示
      if (advice.severity === 'warning' && !isPersisted) {
        console.warn(advice.title, advice.message);
      }
    } catch (error) {
      console.error('Failed to initialize storage:', error);
    }
  };

  const loadPDFRecords = async () => {
    try {
      setLoading(true);
      const records = await getAllPDFRecords();
      setPdfRecords(records);
    } catch (error) {
      console.error('Failed to load PDFs:', error);
      setErrorMessage('Failed to load PDF list');
    } finally {
      setLoading(false);
    }
  };

  const loadSNSLinks = async () => {
    try {
      const links = await getAllSNSLinks();
      setSnsLinks(links);

      // 既存のSNSリンクから選択状態を復元
      const selected = new Set<string>();
      const urls: Record<string, string> = {};

      links.forEach(link => {
        // 既存のリンクから対応するSNSを探す
        const predefined = PREDEFINED_SNS.find(sns =>
          sns.name.toLowerCase() === link.name.toLowerCase() ||
          sns.id === link.id
        );

        if (predefined) {
          selected.add(predefined.id);
          if (link.url !== predefined.defaultUrl) {
            urls[predefined.id] = link.url;
          }
        }
      });

      setSelectedSNS(selected);
      setCustomUrls(urls);
    } catch (error) {
      console.error('Failed to load SNS links:', error);
    }
  };

  // サムネイルを生成する関数
  const generateThumbnail = async (file: File): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        // PDF.jsを動的にインポート
        const pdfjsLib = await import('pdfjs-dist');

        // Workerの設定
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

        // ファイルをArrayBufferとして読み込み
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        // 先頭ページを取得
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.5 }); // サムネイル用に小さく

        // キャンバスを作成
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Canvas context not available'));
          return;
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // レンダリング
        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        // Base64に変換
        const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
        resolve(thumbnail);
      } catch (error) {
        console.error('Failed to generate thumbnail:', error);
        reject(error);
      }
    });
  };

  // ファイル選択（シンプルなBase64保存のみ）
  const handleFileSelect = async () => {
    setUploading(true);
    try {
      // File System Access APIを優先的に使用（より良いUX）
      let file: File | null = null;

      if ('showOpenFilePicker' in window) {
        try {
          const [fileHandle] = await (window as any).showOpenFilePicker({
            types: [
              {
                description: 'PDF Files',
                accept: {
                  'application/pdf': ['.pdf'],
                },
              },
            ],
            multiple: false,
          });
          file = await fileHandle.getFile();
        } catch (error) {
          // ユーザーがキャンセルした場合など
          if (error instanceof Error && error.name !== 'AbortError') {
            console.error('File picker failed:', error);
          }
          setUploading(false);
          return;
        }
      } else {
        // フォールバック：従来の<input type="file">を使用
        file = await new Promise<File | null>((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'application/pdf';
          input.onchange = (e) => {
            const selectedFile = (e.target as HTMLInputElement).files?.[0];
            resolve(selectedFile || null);
          };
          input.click();
        });

        if (!file) {
          setUploading(false);
          return;
        }
      }

      // ファイルサイズチェック（100MBまで）
      if (file.size > 100 * 1024 * 1024) {
        setErrorMessage('ファイルサイズが大きすぎます（最大100MB）');
        setUploading(false);
        return;
      }

      const fileName = file.name;
      const id = generatePDFId(fileName);

      // サムネイルを生成
      const thumbnail = await generateThumbnail(file);

      // ファイル全体をBase64として保存
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binaryString = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64Data = btoa(binaryString);

      // 新しいレコードを作成（Base64データのみ保存）
      const newRecord: PDFFileRecord = {
        id,
        fileName,
        fileData: base64Data, // Base64データを保存
        thumbnail,
        lastOpened: Date.now(),
        drawings: {},
      };

      await savePDFRecord(newRecord);
      await loadPDFRecords();

      // 自動的に開く
      onSelectPDF(newRecord);
    } catch (error) {
      console.error('Failed to add PDF:', error);
      setErrorMessage(`Failed to add PDF: ${error}`);
    } finally {
      setUploading(false);
    }
  };

  // レコード削除（確認ダイアログを表示）
  const handleDeleteClick = (id: string, fileName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 親要素のクリックイベントを防ぐ
    setDeleteConfirm({ id, fileName });
  };

  // 削除を確定
  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await deletePDFRecord(deleteConfirm.id);
      await loadPDFRecords();
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete:', error);
      setErrorMessage('Failed to delete');
      setDeleteConfirm(null);
    }
  };

  // 削除をキャンセル
  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  // レコード選択
  const handleSelectRecord = (record: PDFFileRecord) => {
    try {
      onSelectPDF(record);
    } catch (error) {
      console.error('Failed to open PDF:', error);
      setErrorMessage(`Failed to open PDF: ${error}`);
    }
  };

  // SNS選択状態をトグル
  const toggleSNS = (snsId: string) => {
    setSelectedSNS(prev => {
      const newSet = new Set(prev);
      if (newSet.has(snsId)) {
        newSet.delete(snsId);
        // カスタムURLも削除
        setCustomUrls(urls => {
          const newUrls = { ...urls };
          delete newUrls[snsId];
          return newUrls;
        });
      } else {
        newSet.add(snsId);
      }
      return newSet;
    });
  };

  // カスタムURL変更
  const updateCustomUrl = (snsId: string, url: string) => {
    setCustomUrls(prev => ({
      ...prev,
      [snsId]: url
    }));
  };

  // SNS設定を保存
  const saveSNSSettings = async () => {
    try {
      // 既存のすべてのSNSリンクを削除
      for (const link of snsLinks) {
        await deleteSNSLink(link.id);
      }

      // 選択されたSNSを保存
      for (const snsId of selectedSNS) {
        const sns = PREDEFINED_SNS.find(s => s.id === snsId);
        if (sns) {
          const url = customUrls[snsId] || sns.defaultUrl;
          const newLink: SNSLinkRecord = {
            id: snsId,
            name: sns.name,
            url: url,
            icon: sns.icon,
            createdAt: Date.now()
          };
          await saveSNSLink(newLink);
        }
      }

      await loadSNSLinks();
      setShowSNSSettings(false);
    } catch (error) {
      console.error('Failed to save SNS settings:', error);
      setErrorMessage('Failed to save SNS settings');
    }
  };

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
                onClick={cancelDelete}
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

      {errorMessage && (
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
              {errorMessage}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setErrorMessage(null)}
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
                  onClick={() => handleSelectRecord(record)}
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
                    onClick={(e) => handleDeleteClick(record.id, record.fileName, e)}
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

          <button className="add-button" onClick={handleFileSelect}>
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
