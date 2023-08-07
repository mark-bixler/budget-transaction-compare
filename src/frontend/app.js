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


  fetch('http://localhost:3000/upload', {
    method: 'POST',
    body: formData
  })
    .then(response => response.json())
    .then(data => displayDifferences(data))
    .catch(error => console.error('Error:', error));
});

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
    checkboxCell.appendChild(checkbox); // Append the checkbox element to the checkbox cell

    const checkboxLabel = document.createElement('label')
    checkboxLabel.setAttribute('for', 'checkbox_' + index)
    checkboxLabel.textContent = 'Check item ' + (index + 1);

    const lineNumberCell = document.createElement('td');
    const nameCell = document.createElement('td');
    const envelopeCell = document.createElement('td');
    const amountCell = document.createElement('td');

    lineNumberCell.textContent = index + 1;
    nameCell.textContent = item.name || '';
    envelopeCell.textContent = item.envelope || '';
    amountCell.textContent = item.amount || '';

    row.appendChild(checkboxCell);
    row.appendChild(lineNumberCell);
    row.appendChild(nameCell);
    row.appendChild(envelopeCell);
    row.appendChild(amountCell);

    table.appendChild(row);
  });

}

// add file names to doc upload files
document.getElementById('file1').addEventListener('change', function (e) {
  document.getElementById('file1-name').textContent = e.target.files[0].name;
});

document.getElementById('file2').addEventListener('change', function (e) {
  document.getElementById('file2-name').textContent = e.target.files[0].name;
});

document.getElementById('file3').addEventListener('change', function (e) {
  document.getElementById('file3-name').textContent = e.target.files[0].name;
});

document.getElementById('file4').addEventListener('change', function (e) {
  document.getElementById('file4-name').textContent = e.target.files[0].name;
});

document.getElementById('file5').addEventListener('change', function (e) {
  document.getElementById('file5-name').textContent = e.target.files[0].name;
});