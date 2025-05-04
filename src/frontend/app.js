document.getElementById('upload-form').addEventListener('submit', function (event) {
  event.preventDefault();

  const file1 = document.getElementById('file1').files[0];
  const file2 = document.getElementById('file2').files[0];
  const file3 = document.getElementById('file3').files[0];
  const file4 = document.getElementById('file4').files[0];
  const file5 = document.getElementById('file5').files[0];

  const formData = new FormData();
  formData.append('files', file1);
  formData.append('files', file2);
  formData.append('files', file3);
  formData.append('files', file4);
  formData.append('files', file5);

  fetch(`/upload`, {
    method: 'POST',
    body: formData
  })
    .then(response => response.json())
    .then(data => displayDifferences(data))
    .catch(error => console.error('Error:', error));
});

// Setup for local testing

// Test data
const testData = [
  { name: 'Item 1', envelope: 'Envelope A', formattedAmount: '$100.00' },
  { name: 'Item 2', envelope: 'Envelope B', formattedAmount: '$200.00' },
  { name: 'Item 3', envelope: 'Envelope C', formattedAmount: '$50.00' },
];

// const testButton = document.getElementById('testButton');
// testButton.addEventListener('click', displayDifferences(testData));

function displayDifferences(data) {
  const table = document.getElementById('differences-table');

  // Clear existing data
  while (table.firstChild) {
    table.removeChild(table.firstChild);
  }

  // Add new data
  data.forEach((item, index) => {
    const row = document.createElement('tr');

    const checkboxCell = document.createElement('td'); // Create the checkbox cell
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'checkbox_' + index;
    checkbox.classList.add('custom-checkbox');
    const label = document.createElement('label')
    label.setAttribute('for', 'checkbox_' + index);
    
    checkboxCell.appendChild(checkbox); // Append the checkbox element to the checkbox cell
    const span = document.createElement('span'); // Create the span element
    span.textContent = ''; // Set the text content for the span element
    
    label.appendChild(checkbox); // Append the checkbox element to the label element
    label.appendChild(span); // Append the span element to the label element
    checkboxCell.appendChild(label); // Append the label element to the checkbox cell

    const lineNumberCell = document.createElement('td');
    const nameCell = document.createElement('td');
    const envelopeCell = document.createElement('td');
    const amountCell = document.createElement('td');
    const dateCell = document.createElement('td');

    lineNumberCell.textContent = index + 1;
    nameCell.textContent = item.name || '';
    envelopeCell.textContent = item.envelope || '';
    amountCell.textContent = item.formattedAmount || '';
    dateCell.textContent = item.date || '';

    row.appendChild(checkboxCell);
    row.appendChild(lineNumberCell);
    row.appendChild(nameCell);
    row.appendChild(envelopeCell);
    row.appendChild(amountCell);
    row.appendChild(dateCell);

    table.appendChild(row);
  });
}

// Function to update the label text with the selected file name
function updateLabelWithFileName(inputId) {
  const fileInput = document.getElementById(inputId);
  const label = document.querySelector(`label[for="${inputId}"]`);
  const fileName = fileInput.files[0]?.name || 'Attach file'; // Use the file name if available, otherwise fallback to 'Attach file'
  label.textContent = ` ${fileName}`;
}

// add file names to doc upload files
document.getElementById('file1').addEventListener('change', function (e) {
  updateLabelWithFileName('file1');
});

document.getElementById('file2').addEventListener('change', function (e) {
  updateLabelWithFileName('file2');
});

document.getElementById('file3').addEventListener('change', function (e) {
  updateLabelWithFileName('file3');
});

document.getElementById('file4').addEventListener('change', function (e) {
  updateLabelWithFileName('file4');
});

document.getElementById('file5').addEventListener('change', function (e) {
  updateLabelWithFileName('file5');
});