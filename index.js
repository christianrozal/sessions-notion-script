require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

const bookingsUrl = 'https://api.app.sessions.us/api/booking-pages/d4056e52-9d59-4fe5-9c87-da65f008879a/bookings?page=1';
const apiKey = process.env.SESSIONS_API_KEY;
const notionApiKey = process.env.NOTION_API_KEY;
const notionDatabaseId = process.env.NOTION_DATABASE_ID_CONTACT;
const headers = {
  'accept': 'application/json',
  'x-api-key': apiKey
};

// Function to find a page in Notion database by email
const findPageByEmail = async (email) => {
  const notionUrl = `https://api.notion.com/v1/databases/${notionDatabaseId}/query`;
  const notionHeaders = {
    'Authorization': `Bearer ${notionApiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28'
  };

  const data = {
    filter: {
      property: 'Email',
      rich_text: {
        equals: email
      }
    }
  };

  try {
    const response = await axios.post(notionUrl, data, { headers: notionHeaders });
    if (response.data.results.length > 0) {
      return response.data.results[0].id;
    } else {
      return null;
    }
  } catch (error) {
    console.error(`Error finding page by email ${email}:`, error.response ? error.response.data : error.message);
    return null;
  }
};

// Function to update a page in Notion database
const updateNotionPage = async (pageId, fullName, demoDate) => {
  const notionUrl = `https://api.notion.com/v1/pages/${pageId}`;
  const notionHeaders = {
    'Authorization': `Bearer ${notionApiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28'
  };

  const data = {
    properties: {
      Name: {
        title: [
          {
            text: {
              content: fullName
            }
          }
        ]
      },
      Demo: {
        checkbox: true
      },
      'Demo Date': {
        date: {
          start: demoDate
        }
      }
    }
  };

  try {
    const response = await axios.patch(notionUrl, data, { headers: notionHeaders });
    console.log(`Successfully updated page ${pageId} with name ${fullName} and demo date ${demoDate}.`);
  } catch (error) {
    console.error(`Error updating page ${pageId} with name ${fullName} and demo date ${demoDate}:`, error.response ? error.response.data : error.message);
  }
};

// Function to add guest details to Notion database
const addGuestToNotion = async (email, firstName, lastName, demoDate) => {
  const notionUrl = 'https://api.notion.com/v1/pages';
  const notionHeaders = {
    'Authorization': `Bearer ${notionApiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28'
  };

  const fullName = `${firstName || ''} ${lastName || ''}`.trim();

  const data = {
    parent: { database_id: notionDatabaseId },
    properties: {
      Name: {
        title: [
          {
            text: {
              content: fullName
            }
          }
        ]
      },
      Email: {
        rich_text: [
          {
            text: {
              content: email
            }
          }
        ]
      },
      Demo: {
        checkbox: true
      },
      'Demo Date': {
        date: {
          start: demoDate
        }
      }
    }
  };

  try {
    const response = await axios.post(notionUrl, data, { headers: notionHeaders });
    console.log(`Successfully added guest ${fullName} with email ${email} and demo date ${demoDate} to Notion.`);
  } catch (error) {
    console.error(`Error adding guest ${fullName} with email ${email} and demo date ${demoDate} to Notion:`, error.response ? error.response.data : error.message);
  }
};

// Function to fetch participants using sessionId
const fetchParticipants = async (sessionId, demoDate) => {
  const participantsUrl = `https://api.app.sessions.us/api/sessions/${sessionId}/participants`;

  try {
    const response = await axios.get(participantsUrl, { headers });
    console.log(`Participants data for session ${sessionId}:`, response.data);

    // Filter out participants who are not the host
    const nonHostParticipants = response.data.filter(participant => !participant.isOwner);

    // Process only the first non-host participant
    if (nonHostParticipants.length > 0) {
      const participant = nonHostParticipants[0];
      const { email, firstName, lastName } = participant.guest || participant.user;

      if (email) {
        const pageId = await findPageByEmail(email);
        if (pageId) {
          await updateNotionPage(pageId, `${firstName || ''} ${lastName || ''}`.trim(), demoDate);
        } else {
          await addGuestToNotion(email, firstName || '', lastName || '', demoDate);
        }
      }
    } else {
      console.log('No non-host participants found for session:', sessionId);
    }
  } catch (error) {
    if (error.response) {
      console.error(`Error response for session ${sessionId}:`, error.response.status);
      console.error('Error data:', error.response.data);
    } else if (error.request) {
      console.error(`Error request for session ${sessionId}:`, error.request);
    } else {
      console.error('Error message:', error.message);
    }
  }
};

// Main function to get bookings and then participants
const fetchBookingsAndParticipants = async () => {
  try {
    const response = await axios.get(bookingsUrl, { headers });
    console.log('Response data:', response.data);

    if (response.data && response.data.length > 0) {
      // Sort bookings by startAt date
      const sortedBookings = response.data.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
      console.log('Sorted Bookings:', sortedBookings);

      // Fetch participants for each sessionId
      for (const booking of sortedBookings) {
        await fetchParticipants(booking.sessionId, booking.startAt);
      }
    } else {
      console.log('No bookings found.');
    }
  } catch (error) {
    if (error.response) {
      console.error('Error response:', error.response.status);
      console.error('Error data:', error.response.data);
    } else if (error.request) {
      console.error('Error request:', error.request);
    } else {
      console.error('Error message:', error.message);
    }
  }
};

// Call the main function
fetchBookingsAndParticipants();
