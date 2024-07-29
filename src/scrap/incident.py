# import requests
# from bs4 import BeautifulSoup

# def scrape_website(url):
#     try:
#         with requests.Session() as session:
#             response = session.get(url)
#             response.raise_for_status()
#             soup = BeautifulSoup(response.content, 'html.parser')
            
#             # Select only the relevant part of the HTML to parse
#             incident_list = soup.find_all('ul', class_="block-grid block-grid--mobile-1 block-grid--tablet-2 block-grid--full-4")
            
#             new_incidents = []
            
#             for incident in incident_list:
#                 incident_items = incident.find_all('li')
                
#                 for incident_item in incident_items:
#                     incident_title = incident_item.find('h3', class_='box--cta__title').text.strip()
#                     incident_time = incident_item.find('p').text.strip()
                    
#                     new_incidents.append({'title': incident_title, 'time': incident_time})
            
#             return new_incidents
    
#     except requests.RequestException as e:
#         print(f"An error occurred while fetching the webpage: {e}")
#         return []

# def print_incidents(incidents):
#     if incidents:
#         print(f"{len(incidents)} incidents found:")
        
#         for incident in incidents:
#             print("Title:", incident['title'])
#             print("Date:", incident['time'])
#             print()
#     else:
#         print("No incidents found.")

# if __name__ == "__main__":
#     url = "https://www.stib-mivb.be/search.html?l=fr&_tags=work,network_information&_type=0"
#     incidents = scrape_website(url)
#     print_incidents(incidents)
import csv
import requests
from bs4 import BeautifulSoup

def scrape_website(url):
    try:
        with requests.Session() as session:
            response = session.get(url)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Select only the relevant part of the HTML to parse
            incident_list = soup.find_all('ul', class_="block-grid block-grid--mobile-1 block-grid--tablet-2 block-grid--full-4")
            
            new_incidents = []
            
            for incident in incident_list:
                incident_items = incident.find_all('li')
                
                for incident_item in incident_items:
                    incident_title = incident_item.find('h3', class_='box--cta__title').text.strip()
                    incident_time = incident_item.find('p').text.strip()
                    
                    new_incidents.append({'Title': incident_title, 'Date': incident_time})
            
            return new_incidents
    
    except requests.RequestException as e:
        print(f"An error occurred while fetching the webpage: {e}")
        return []

def write_to_csv(data):
    # Specify the CSV file name
    csv_file = "transport.csv"
    
    # Define fieldnames for the CSV file
    fieldnames = ["Title", "Date"]
    
    # Write data to the CSV file
    with open(csv_file, mode='w', newline='', encoding='utf-8') as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        for entry in data:
            writer.writerow(entry)

if __name__ == "__main__":
    url = "https://www.stib-mivb.be/search.html?l=fr&_tags=work,network_information&_type=0"
    incidents = scrape_website(url)
    if incidents:
        write_to_csv(incidents)
        print("Data has been successfully saved to 'transport.csv'")
    else:
        print("No data available.")
