import { useState } from 'react'
import AdminPanel from './components/AdminPanel'
import PDFViewer from './components/PDFViewer'
import { PDFFileRecord } from './utils/indexedDB'

type AppView = 'admin' | 'viewer'

function App() {
  const [currentView, setCurrentView] = useState<AppView>('admin')
  const [selectedPDF, setSelectedPDF] = useState<PDFFileRecord | null>(null)

  const handleSelectPDF = (record: PDFFileRecord) => {
    setSelectedPDF(record)
    setCurrentView('viewer')
  }

  const handleBackToAdmin = () => {
    setCurrentView('admin')
    setSelectedPDF(null)
  }

  return (
    <div className="app">
      {currentView === 'admin' ? (
        <AdminPanel onSelectPDF={handleSelectPDF} />
      ) : selectedPDF ? (
        <PDFViewer
          pdfRecord={selectedPDF}
          pdfId={selectedPDF.id}
          onBack={handleBackToAdmin}
        />
      ) : (
        <div>No PDF selected</div>
      )}
    </div>
  )
}

export default App
