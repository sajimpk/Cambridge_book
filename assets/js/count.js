(() => {
  const totalElement = document.getElementById('totalClicks');
  const todayElement = document.getElementById('todayClicks');
  const tableBody = document.getElementById('dailyClicksBody');
  const statusElement = document.getElementById('countStatus');
  const deleteButton = document.getElementById('deleteOldClicks');
  const countryDialog = document.getElementById('countryDialog');
  const countryDialogDate = document.getElementById('countryDialogDate');
  const countryDialogBody = document.getElementById('countryDialogBody');
  const closeCountryDialog = document.getElementById('closeCountryDialog');
  const countryPagination = document.getElementById('countryPagination');
  const previousCountryPage = document.getElementById('previousCountryPage');
  const nextCountryPage = document.getElementById('nextCountryPage');
  const countryPageStatus = document.getElementById('countryPageStatus');
  const countriesPerPage = 8;
  let reportAdminKey = '';
  let countryRows = [];
  let currentCountryPage = 1;
  const formatter = new Intl.NumberFormat();
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  });

  function formatDate(date) {
    return dateFormatter.format(new Date(`${date}T00:00:00Z`));
  }

  function countryFlag(countryCode) {
    if (!/^[A-Z]{2}$/.test(countryCode) || countryCode === 'XX') return '🌐';
    return String.fromCodePoint(...countryCode.split('').map((letter) => 127397 + letter.charCodeAt(0)));
  }

  function countryName(countryCode) {
    if (countryCode === 'XX') return 'Unknown country';
    try {
      return new Intl.DisplayNames(undefined, { type: 'region' }).of(countryCode) || countryCode;
    } catch {
      return countryCode;
    }
  }

  function getDateInTimeZone(timeZone) {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    const getPart = (type) => parts.find((part) => part.type === type)?.value;
    return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  }

  async function loadReport() {
    try {
      const response = await fetch('/api/claim-clicks?days=365', { cache: 'no-store' });
      if (!response.ok) throw new Error('Report request failed');

      const data = await response.json();
      const daily = Array.isArray(data.daily) ? data.daily : [];
      const today = getDateInTimeZone(data.timeZone || 'Asia/Dhaka');
      const todayRecord = daily.find((item) => item.click_date === today);

      totalElement.textContent = formatter.format(Number(data.count || 0));
      todayElement.textContent = formatter.format(Number(todayRecord?.total_clicks || 0));
      statusElement.textContent = `Daily totals use ${data.timeZone || 'Asia/Dhaka'} time.`;

      if (!daily.length) {
        tableBody.innerHTML = '<tr><td colspan="2" class="count-empty">No clicks recorded yet.</td></tr>';
        return;
      }

      tableBody.innerHTML = daily.map((item) => `
        <tr>
          <td><button class="count-date-button" type="button" data-click-date="${item.click_date}">${formatDate(item.click_date)}</button></td>
          <td>${formatter.format(Number(item.total_clicks || 0))}</td>
        </tr>
      `).join('');
    } catch (error) {
      console.error(error);
      statusElement.textContent = 'Unable to load the click report. Please refresh.';
      tableBody.innerHTML = '<tr><td colspan="2" class="count-empty">Report unavailable.</td></tr>';
    }
  }

  function openCountryDialog() {
    if (typeof countryDialog.showModal === 'function') countryDialog.showModal();
    else countryDialog.setAttribute('open', '');
  }

  function renderCountryPage() {
    countryDialogBody.replaceChildren();
    countryDialogBody.scrollTop = 0;

    if (!countryRows.length) {
      const empty = document.createElement('p');
      empty.className = 'count-empty';
      empty.textContent = 'No country data is available for this date. Country tracking starts after this feature is deployed.';
      countryDialogBody.append(empty);
      countryPagination.hidden = true;
      return;
    }

    const totalPages = Math.ceil(countryRows.length / countriesPerPage);
    currentCountryPage = Math.min(Math.max(currentCountryPage, 1), totalPages);
    const pageStart = (currentCountryPage - 1) * countriesPerPage;
    const visibleCountries = countryRows.slice(pageStart, pageStart + countriesPerPage);

    visibleCountries.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'country-click-row';

      const identity = document.createElement('div');
      identity.className = 'country-click-row__identity';

      const flag = document.createElement('span');
      flag.className = 'country-click-row__flag';
      flag.textContent = countryFlag(item.country_code);

      const label = document.createElement('span');
      label.textContent = countryName(item.country_code);

      const code = document.createElement('small');
      code.textContent = item.country_code;
      label.append(code);

      const clicks = document.createElement('strong');
      clicks.textContent = formatter.format(Number(item.total_clicks || 0));

      identity.append(flag, label);
      row.append(identity, clicks);
      countryDialogBody.append(row);
    });

    countryPagination.hidden = totalPages <= 1;
    countryPageStatus.textContent = `Page ${currentCountryPage} of ${totalPages}`;
    previousCountryPage.disabled = currentCountryPage === 1;
    nextCountryPage.disabled = currentCountryPage === totalPages;
  }

  function renderCountries(countries) {
    countryRows = countries;
    currentCountryPage = 1;
    renderCountryPage();
  }

  async function loadCountryReport(clickDate) {
    if (!reportAdminKey) {
      reportAdminKey = window.prompt('Enter the count report admin key:') || '';
    }
    if (!reportAdminKey) return;

    countryDialogDate.textContent = formatDate(clickDate);
    countryDialogBody.innerHTML = '<p class="count-empty">Loading country data…</p>';
    countryPagination.hidden = true;
    openCountryDialog();

    try {
      const response = await fetch(`/api/claim-clicks/countries?date=${encodeURIComponent(clickDate)}`, {
        headers: { 'x-admin-key': reportAdminKey },
        cache: 'no-store'
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) reportAdminKey = '';
        throw new Error(data.error || 'Country report request failed');
      }

      renderCountries(Array.isArray(data.countries) ? data.countries : []);
    } catch (error) {
      countryDialogBody.innerHTML = '';
      const message = document.createElement('p');
      message.className = 'count-empty';
      message.textContent = error.message || 'Unable to load country click data.';
      countryDialogBody.append(message);
    }
  }

  async function deleteOldClicks() {
    const adminKey = reportAdminKey || window.prompt('Enter the count report admin key:');
    if (!adminKey) return;
    reportAdminKey = adminKey;

    const confirmed = window.confirm(
      'Delete daily records outside the most recent 7 days? Today and the previous 6 days will remain.'
    );
    if (!confirmed) return;

    deleteButton.disabled = true;
    deleteButton.textContent = 'Deleting…';

    try {
      const response = await fetch('/api/claim-clicks', {
        method: 'DELETE',
        headers: { 'x-admin-key': adminKey }
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) reportAdminKey = '';
        throw new Error(data.error || 'Delete request failed');
      }

      window.alert(
        `Deleted ${formatter.format(data.deletedRows)} old day(s), containing ${formatter.format(data.deletedClicks)} click(s).`
      );
      await loadReport();
    } catch (error) {
      window.alert(error.message || 'Unable to delete old click data.');
    } finally {
      deleteButton.disabled = false;
      deleteButton.textContent = 'Delete data older than 7 days';
    }
  }

  tableBody.addEventListener('click', (event) => {
    const dateButton = event.target.closest('[data-click-date]');
    if (dateButton) loadCountryReport(dateButton.dataset.clickDate);
  });
  closeCountryDialog.addEventListener('click', () => countryDialog.close());
  previousCountryPage.addEventListener('click', () => {
    currentCountryPage -= 1;
    renderCountryPage();
  });
  nextCountryPage.addEventListener('click', () => {
    currentCountryPage += 1;
    renderCountryPage();
  });
  countryDialog.addEventListener('click', (event) => {
    if (event.target === countryDialog) countryDialog.close();
  });
  deleteButton.addEventListener('click', deleteOldClicks);
  loadReport();
})();
