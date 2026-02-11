// import { OrganSystem } from '@/types/TestsServiceTypes';
// import { USMLEStandardCategory, LearningObjective } from '../types';

// export const exportToCSV = (data: USMLEStandardCategory[]) => {
//   const headers = ['System', 'Topic', 'Subtopics', 'Objective ID', 'Objective Text', 'Bloom Level'];
//   const rows: string[] = [];
  
//   data.forEach(sys => {
//     sys.topics.forEach(topic => {
//         const subtopicsStr = topic.subTopics?.join('; ') || '';
//         if (topic.objectives && topic.objectives.length > 0) {
//             topic.objectives.forEach(obj => {
//                 rows.push([
//                     `"${sys.name}"`,
//                     `"${topic.name}"`,
//                     `"${subtopicsStr}"`,
//                     obj.id,
//                     `"${obj.text.replace(/"/g, '""')}"`, // Escape quotes
//                     obj.bloomLevel
//                 ].join(','));
//             });
//         } else {
//             rows.push([
//               `"${sys.name}"`,
//               `"${topic.name}"`,
//               `"${subtopicsStr}"`,
//               '', '', ''
//             ].join(','));
//         }
//     });
//   });
  
//   const csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + "\n" + rows.join('\n');
//   const encodedUri = encodeURI(csvContent);
//   const link = document.createElement("a");
//   link.setAttribute("href", encodedUri);
//   link.setAttribute("download", "curriculum_export.csv");
//   document.body.appendChild(link);
//   link.click();
//   document.body.removeChild(link);
// };

// export const processCSV = (csvText: string, currentData: OrganSystem[]) => {
//   const lines = csvText.split(/\r\n|\n/);
//   // Deep clone to allow safe mutation
//   const newData = JSON.parse(JSON.stringify(currentData)) as OrganSystem[]; 
//   let importedCount = 0;

//   for (let i = 1; i < lines.length; i++) {
//       const line = lines[i];
//       if (!line.trim()) continue;
      
//       const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, ''));
      
//       if (cols.length < 3) continue;

//       const systemName = cols[0];
//       const topicName = cols[1];
      
//       let objText = '';
//       let bloom = 'Understand';

//       if (cols.length >= 6) {
//           objText = cols[4];
//           bloom = cols[5] || 'Understand';
//       } else {
//           objText = cols[2];
//           bloom = cols[3] || 'Understand';
//       }

//       if (!systemName || !topicName || !objText) continue;

//       let systemIndex = newData.findIndex(s => s.title.toLowerCase() === systemName.toLowerCase());
//       if (systemIndex === -1) {
//           const newSys: OrganSystem = {
//               id: `SYS-${Date.now()}-${i}`,
//               title: systemName,
//               topics: []
//           };
//           newData.push(newSys);
//           systemIndex = newData.length - 1;
//       }

//       let topic = newData[systemIndex].topics.find(t => t.name.toLowerCase() === topicName.toLowerCase());
//       if (!topic) {
//           topic = {
//               id: `TOP-${Date.now()}-${i}`,
//               name: topicName,
//               subTopics: [],
//               objectives: []
//           };
//           newData[systemIndex].topics.push(topic);
//       }

//       if (!topic.objectives) topic.objectives = [];
//       const exists = topic.objectives.some(o => o.text.toLowerCase() === objText.toLowerCase());
//       if (!exists) {
//           topic.objectives.push({
//               id: `OBJ-IMP-${Date.now()}-${i}`,
//               text: objText,
//               bloomLevel: bloom,
//               organSystemId: newData[systemIndex].id,
//               disciplineId: 'DISC-GEN',
//               usmleContentId: 'USMLE-IMP',
//               linkedItemIds: [],
//               linkedLectureIds: [],
//               targetItemCount: 1, // Default
//               targetLectureCount: 1 // Default
//           });
//           importedCount++;
//       }
//   }
  
//   return { success: true, data: newData, count: importedCount };
// };

// export const exportToJSON = (data: any, filename: string) => {
//   const jsonStr = JSON.stringify(data, null, 2);
//   const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonStr);
  
//   const link = document.createElement('a');
//   link.setAttribute('href', dataUri);
//   link.setAttribute('download', filename);
//   document.body.appendChild(link);
//   link.click();
//   document.body.removeChild(link);
// };

// export const importFromJSON = (file: File): Promise<any> => {
//   return new Promise((resolve, reject) => {
//     const reader = new FileReader();
//     reader.onload = (event) => {
//       try {
//         const json = JSON.parse(event.target?.result as string);
//         resolve(json);
//       } catch (error) {
//         reject(error);
//       }
//     };
//     reader.onerror = (error) => reject(error);
//     reader.readAsText(file);
//   });
// };
