
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MeetingNote, User, GeminiOutput, ModalConfig } from './types';
import * as firebaseService from './services/firebaseService';
import * as geminiService from './services/geminiService';
import Modal from './components/Modal';
import Loader from './components/Loader';
import { MicIcon, SaveIcon, NewNoteIcon, SummarizeIcon, ActionItemIcon, DeleteIcon, ThinkingIcon, AlertTriangleIcon } from './components/icons';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingAttendees, setMeetingAttendees] = useState('');
  const [meetingDate, setMeetingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [transcript, setTranscript] = useState('');
  
  const [savedNotes, setSavedNotes] = useState<MeetingNote[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [speechStatus, setSpeechStatus] = useState('ចុចប៊ូតុងដើម្បីចាប់ផ្តើម');
  
  const [geminiOutput, setGeminiOutput] = useState<GeminiOutput | null>(null);
  const [isGeminiLoading, setIsGeminiLoading] = useState(false);
  
  const [modalConfig, setModalConfig] = useState<ModalConfig>({ isOpen: false, title: '', message: '' });

  const recognitionRef = useRef<any>(null); // SpeechRecognition instance
  const transcriptOutputRef = useRef<HTMLTextAreaElement>(null); // For auto-scrolling

  useEffect(() => {
    const unsubscribeAuth = firebaseService.onAuthStateChanged((user) => {
      setCurrentUser(user);
      if (!user) {
        // Clear notes if user logs out or fails to authenticate
        setSavedNotes([]);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (currentUser?.uid) {
      const unsubscribeNotes = firebaseService.fetchNotesStream(
        currentUser.uid,
        (notes) => setSavedNotes(notes),
        (error) => {
          console.error("Error fetching notes stream:", error);
          showModal('បញ្ហាក្នុងការទាញកំណត់ត្រា', `មិនអាចទាញយកកំណត់ត្រាបានទេ៖ ${error.message}`);
        }
      );
      return () => unsubscribeNotes();
    }
  }, [currentUser]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'km-KH';

      recognitionRef.current.onstart = () => {
        setIsRecording(true);
        setSpeechStatus('កំពុងស្តាប់...');
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
        setSpeechStatus('ចុចប៊ូតុងដើម្បីចាប់ផ្តើម');
      };

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscriptChunk = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscriptChunk += event.results[i][0].transcript;
          }
        }
        if (finalTranscriptChunk.trim()) {
          setTranscript(prev => prev + finalTranscriptChunk + '។ ');
          if (transcriptOutputRef.current) {
            transcriptOutputRef.current.scrollTop = transcriptOutputRef.current.scrollHeight;
          }
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        let errorMessage = `មានបញ្ហា៖ ${event.error}`;
         if (event.error === 'not-allowed' || event.error === 'permission-denied') {
            errorMessage = 'កម្មវិធីមិនអាចចូលប្រើមីក្រូហ្វូនបានទេ។ សូមប្រាកដថាអ្នកបានអនុញ្ញាតឱ្យគេហទំព័រនេះប្រើមីក្រូហ្វូនរបស់អ្នកនៅក្នុងការកំណត់កម្មវិធីរុករក។ អ្នកប្រហែលជាត្រូវផ្ទុកទំព័រឡើងវិញបន្ទាប់ពីបានផ្តល់សិទ្ធិ។';
        } else if (event.error === 'no-speech') {
            errorMessage = 'មិនបានរកឃើញសំឡេងទេ។ សូមព្យាយាមម្តងទៀត។';
        } else if (event.error === 'audio-capture') {
             errorMessage = 'បញ្ហាក្នុងការចាប់យកសំឡេង។ សូមប្រាកដថាមីក្រូហ្វូនរបស់អ្នកដំណើរការត្រឹមត្រូវ។';
        }
        showModal('បញ្ហាជាមួយការសម្គាល់សំឡេង', errorMessage);
        setIsRecording(false); // Ensure recording state is reset
      };
    } else {
      showModal('កម្មវិធីរុករកមិនគាំទ្រ', 'សូមអភ័យទោស! កម្មវិធីរុករករបស់អ្នកមិនគាំទ្រមុខងារបំប្លែងសំឡេងទៅជាអក្សរទេ។');
    }

    return () => {
      if (recognitionRef.current && isRecording) {
        recognitionRef.current.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount to setup SpeechRecognition

  const showModal = (title: string, message: string, isConfirmation = false, onConfirm?: () => void, confirmText?: string) => {
    setModalConfig({ isOpen: true, title, message, isConfirmation, onConfirm, confirmText });
  };

  const closeModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  const handleStartStopRecording = () => {
    if (!recognitionRef.current) {
      showModal('មុខងារមិនអាចប្រើបាន', 'មុខងារសម្គាល់សំឡេងមិនមាននៅលើកម្មវិធីរុករកនេះទេ។');
      return;
    }
    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      try {
        setTranscript(''); // Clear previous transcript before starting new recording
        setGeminiOutput(null); // Clear previous gemini output
        recognitionRef.current.start();
      } catch (e: any) {
        console.error("Error starting recognition:", e);
        showModal('បញ្ហាក្នុងការចាប់ផ្តើម', `មិនអាចចាប់ផ្តើមការថតសំឡេងបានទេ៖ ${e.message}. សូមប្រាកដថាមិនមានកម្មវិធីផ្សេងទៀតកំពុងប្រើប្រាស់មីក្រូហ្វូន។`);
      }
    }
  };

  const clearEditor = useCallback(() => {
    setCurrentNoteId(null);
    setMeetingTitle('');
    setMeetingAttendees('');
    setMeetingDate(new Date().toISOString().split('T')[0]);
    setTranscript('');
    setGeminiOutput(null);
    if (document.getElementById('meeting-title')) {
      (document.getElementById('meeting-title') as HTMLInputElement).focus();
    }
  }, []);

  const handleSaveNote = async () => {
    if (!currentUser?.uid) {
      showModal('មិនអាចរក្សាទុកបានទេ', 'អ្នកប្រើប្រាស់មិនទាន់បានផ្ទៀងផ្ទាត់ទេ។ សូមព្យាយាមម្តងទៀត។');
      return;
    }
    if (!meetingTitle.trim()) {
      showModal('ត្រូវការប្រធានបទ', 'សូមបញ្ចូលប្រធានបទសម្រាប់កំណត់ត្រារបស់អ្នក។');
      return;
    }

    const noteData = {
      userId: currentUser.uid,
      title: meetingTitle.trim(),
      attendees: meetingAttendees.trim(),
      date: meetingDate,
      transcript: transcript.trim(),
    };

    try {
      if (currentNoteId) {
        await firebaseService.updateNote(currentNoteId, noteData);
        showModal('បានធ្វើបច្ចុប្បន្នភាព', 'កំណត់ត្រារបស់អ្នកត្រូវបានធ្វើបច្ចុប្បន្នភាពដោយជោគជ័យ។');
      } else {
        const newNoteId = await firebaseService.saveNote(noteData as Omit<MeetingNote, 'id' | 'createdAt' | 'updatedAt'>);
        setCurrentNoteId(newNoteId); // Set current ID after saving new note
        showModal('បានរក្សាទុក', 'កំណត់ត្រារបស់អ្នកត្រូវបានរក្សាទុកដោយជោគជ័យ។');
      }
      // Don't clear editor immediately after save, user might want to continue editing or use AI features.
      // Clear editor when "New Note" is clicked or a different note is loaded.
    } catch (error: any) {
      console.error("Error saving note: ", error);
      showModal('មានបញ្ហា', `មិនអាចរក្សាទុកកំណត់ត្រាបានទេ៖ ${error.message}`);
    }
  };
  
  const handleLoadNote = useCallback((note: MeetingNote) => {
    clearEditor(); // Clear previous state including AI output
    setCurrentNoteId(note.id);
    setMeetingTitle(note.title);
    setMeetingAttendees(note.attendees || '');
    setMeetingDate(note.date || new Date().toISOString().split('T')[0]);
    setTranscript(note.transcript || '');
  }, [clearEditor]);

  const handleDeleteNote = (noteId: string) => {
    showModal(
      'បញ្ជាក់ការលុប',
      'តើអ្នកពិតជាចង់លុបកំណត់ត្រានេះមែនទេ? សកម្មភាពនេះមិនអាចមិនធ្វើវិញបានទេ។',
      true,
      async () => {
        try {
          await firebaseService.deleteNoteFirebase(noteId);
          showModal('បានលុប', 'កំណត់ត្រាត្រូវបានលុបដោយជោគជ័យ។');
          if (currentNoteId === noteId) {
            clearEditor();
          }
        } catch (error: any) {
          console.error("Error deleting note: ", error);
          showModal('បញ្ហាក្នុងការលុប', `មិនអាចលុបកំណត់ត្រាបានទេ៖ ${error.message}`);
        }
      },
      'បញ្ជាក់ការលុប'
    );
  };

  const callGeminiFeature = async (
    featureFn: (transcript: string) => Promise<string>, 
    title: string
  ) => {
    if (!transcript.trim()) {
      showModal('ត្រូវការអត្ថបទ', 'សូមបញ្ចូលអត្ថបទកំណត់ត្រាជាមុនសិន។');
      return;
    }
    setIsGeminiLoading(true);
    setGeminiOutput({ title, content: '' }); // Show title immediately
    try {
      const resultText = await featureFn(transcript);
      const formattedContent = geminiService.formatGeminiResponseForDisplay(resultText);
      setGeminiOutput({ title, content: formattedContent });
    } catch (error: any) {
      console.error(`Gemini feature "${title}" failed:`, error);
      setGeminiOutput({ title, content: `<p class="text-red-600">មានបញ្ហាក្នុងការបង្កើតខ្លឹមសារ៖ ${error.message}</p>` });
      showModal('បញ្ហា AI', `ការហៅទៅ Gemini API បានបរាជ័យ៖ ${error.message}`);
    } finally {
      setIsGeminiLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-700">កម្មវិធីកត់ត្រាកិច្ចប្រជុំឆ្លាតវៃ</h1>
        <p className="text-slate-500 mt-2">បំពាក់ដោយ Gemini API ដើម្បីសង្ខេប និងដកស្រង់កិច្ចការ</p>
      </header>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main Content: Note Editor */}
        <main className="w-full lg:w-2/3 bg-white p-6 rounded-xl shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 border-b pb-2 text-slate-700">កែសម្រួលកំណត់ត្រា</h2>
          
          <div className="mb-4">
            <label htmlFor="meeting-title" className="block text-sm font-medium text-slate-600 mb-1">ប្រធានបទកិច្ចប្រជុំ</label>
            <input 
              type="text" 
              id="meeting-title" 
              placeholder="ឧ. កិច្ចប្រជុំប្រចាំត្រីមាស" 
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="meeting-attendees" className="block text-sm font-medium text-slate-600 mb-1">អ្នកចូលរួម</label>
              <input 
                type="text" 
                id="meeting-attendees" 
                placeholder="ឧ. សុខ, ចាន់ណា" 
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                value={meetingAttendees}
                onChange={(e) => setMeetingAttendees(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="meeting-date" className="block text-sm font-medium text-slate-600 mb-1">កាលបរិច្ឆេទ</label>
              <input 
                type="date" 
                id="meeting-date" 
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
              />
            </div>
          </div>
          
          <div className="mb-4">
            <label htmlFor="transcript-output" className="block text-sm font-medium text-slate-600 mb-1">កំណត់ត្រា (អត្ថបទដែលបានបំប្លែង)</label>
            <textarea 
              id="transcript-output" 
              ref={transcriptOutputRef}
              rows={10} 
              placeholder="អត្ថបទដែលបានបំប្លែងពីសំឡេងនឹងបង្ហាញនៅទីនេះ..." 
              className="w-full p-3 border border-slate-300 rounded-lg custom-scrollbar focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)} // Allow manual editing
            ></textarea>
          </div>

          <div className="flex items-center justify-between gap-4 flex-wrap border-b pb-4 mb-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={handleStartStopRecording}
                disabled={!recognitionRef.current}
                className={`px-6 py-3 text-white font-bold rounded-lg transition shadow-md flex items-center gap-2 ${
                  isRecording 
                  ? 'bg-red-600 hover:bg-red-700 recording-pulse' 
                  : 'bg-blue-600 hover:bg-blue-700'
                } ${!recognitionRef.current ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <MicIcon />
                <span>{isRecording ? 'បញ្ឈប់ការថតសំឡេង' : 'ចាប់ផ្តើមថតសំឡេង'}</span>
              </button>
              <div id="status" className="text-sm text-slate-500">{speechStatus}</div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={clearEditor}
                className="px-4 py-2 bg-slate-200 text-slate-800 font-semibold rounded-lg hover:bg-slate-300 transition flex items-center gap-2"
              >
                <NewNoteIcon className="w-4 h-4" /> កំណត់ត្រាថ្មី
              </button>
              <button 
                onClick={handleSaveNote}
                disabled={!currentUser || !meetingTitle.trim()}
                className="px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 active:bg-green-800 transition shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SaveIcon /> រក្សាទុក
              </button>
            </div>
          </div>
          
          {/* Gemini AI Features */}
          <div>
            <h3 className="text-lg font-semibold text-slate-700 mb-3">មុខងារឆ្លាតវៃ ✨</h3>
            <div className="flex flex-wrap gap-3 mb-4">
              <button 
                onClick={() => callGeminiFeature(geminiService.summarizeTranscript, "សេចក្តីសង្ខេបកិច្ចប្រជុំ")}
                disabled={isGeminiLoading || !transcript.trim()}
                className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50"
              >
                <SummarizeIcon className="w-4 h-4"/> ✨ សង្ខេបកិច្ចប្រជុំ
              </button>
              <button 
                onClick={() => callGeminiFeature(geminiService.extractActionItems, "កិច្ចការត្រូវធ្វើ")}
                disabled={isGeminiLoading || !transcript.trim()}
                className="px-4 py-2 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition flex items-center gap-2 disabled:opacity-50"
              >
                <ActionItemIcon className="w-4 h-4"/> ✨ ដកស្រង់កិច្ចការ
              </button>
            </div>
            {(geminiOutput || isGeminiLoading) && (
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200 min-h-[100px]">
                {geminiOutput?.title && <h4 className="font-bold text-indigo-800 mb-2">{geminiOutput.title}</h4>}
                {isGeminiLoading && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <ThinkingIcon className="w-5 h-5 text-indigo-600" />
                    <p>កំពុងដំណើរការ... សូមរង់ចាំបន្តិច។</p>
                  </div>
                )}
                {!isGeminiLoading && geminiOutput?.content && (
                  <div 
                    className="text-slate-700 prose prose-sm max-w-none prose-ul:list-disc prose-ul:pl-5 prose-li:mb-1"
                    dangerouslySetInnerHTML={{ __html: geminiOutput.content }}
                  />
                )}
              </div>
            )}
          </div>
        </main>

        {/* Sidebar: Saved Notes */}
        <aside className="w-full lg:w-1/3 bg-white p-6 rounded-xl shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 border-b pb-2 text-slate-700">កំណត់ត្រាដែលបានរក្សាទុក</h2>
          <div className="space-y-3 h-[450px] overflow-y-auto custom-scrollbar pr-2">
            {!currentUser && <p className="text-slate-400">កំពុងផ្ទៀងផ្ទាត់អ្នកប្រើប្រាស់...</p>}
            {currentUser && savedNotes.length === 0 && <p className="text-slate-400">មិនទាន់មានកំណត់ត្រា...</p>}
            {currentUser && savedNotes.map(note => (
              <div 
                key={note.id} 
                className={`p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition ${currentNoteId === note.id ? 'bg-blue-50 border-blue-300' : 'border-slate-200'}`}
                onClick={() => handleLoadNote(note)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-700">{note.title}</h4>
                    <p className="text-sm text-slate-500">
                      {note.date ? new Date(note.date).toLocaleDateString('km-KH', { year: 'numeric', month: 'long', day: 'numeric'}) : 'មិនមានកាលបរិច្ឆេទ'}
                    </p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }}
                    className="text-red-400 hover:text-red-600 font-bold p-1 leading-none text-xl"
                    aria-label="លុបកំណត់ត្រា"
                  >
                    <DeleteIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
      
      <footer className="text-center mt-8 text-slate-400 text-sm">
        <p>UserID: <span className="font-mono">{currentUser?.uid || 'មិនទាន់ផ្ទៀងផ្ទាត់'}</span></p>
        <p>AppID: <span className="font-mono">{firebaseService.getAppId()}</span></p>
      </footer>

      <Modal 
        {...modalConfig}
        onClose={closeModal}
      />
      {process.env.API_KEY === undefined && (
          <div className="fixed bottom-4 right-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md shadow-lg z-[100]">
            <div className="flex">
              <div className="py-1"><AlertTriangleIcon className="h-6 w-6 text-yellow-500 mr-3" /></div>
              <div>
                <p className="font-bold">API Key Missing</p>
                <p className="text-sm">Gemini API key is not configured. AI features will not work.</p>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default App;
