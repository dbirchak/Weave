package infomap.admin;

import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Iterator;
import java.util.List;
import java.util.Properties;

import org.apache.solr.common.SolrInputDocument;

import com.mendeley.oapi.common.PagedList;
import com.mendeley.oapi.schema.Document;
import com.mendeley.oapi.schema.Person;
import com.mendeley.oapi.services.MendeleyException;
import com.mendeley.oapi.services.MendeleyServiceFactory;
import com.mendeley.oapi.services.SearchService;
import com.sun.org.apache.xerces.internal.impl.xpath.regex.ParseException;

import flex.messaging.io.ArrayList;

public class MendeleyDataSource extends AbstractDataSource {
	
	public MendeleyDataSource() {
		
		Properties prop = new Properties();
		try{
			InputStream config = getClass().getClassLoader().getResourceAsStream("infomap/resources/config.properties");
			prop.load(config);
			
			CONSUMER_KEY = prop.getProperty("mendeleyConsumerKey");
			CONSUMER_SECRET = prop.getProperty("mendeleyConsumerSecret");
		}catch (Exception e)
		{
			System.out.println("Error reading configuration file");
		}
	}
	
	/** The Constant CONSUMER_KEY. */
	private String CONSUMER_KEY = "";
	
	/** The Constant CONSUMER_SECRET. */
	private String CONSUMER_SECRET = "";
	
	public static String SOURCE_NAME = "MENDELEY";
	@Override
	String getSourceName() {
		return SOURCE_NAME;
	}
	
	@Override
	String getSourceType() {
		return "Papers";
	}
	
	private static int numberOfDocumentsPerRequest = 20;
	
	private String generateQuery(String requiredTerm)
	{
		String result = requiredTerm;
		
		if(relatedQueryTerms == null || relatedQueryTerms.length == 0)
		{
			try
			{
				result = URLEncoder.encode(result, "UTF-8");
				return result;
			}catch (Exception e) {
				System.out.println("Error encoding");
				return "";
			}
		}
		
		result +=  " AND (";
		
		for (int i = 0; i <relatedQueryTerms.length; i++)
		{
			result = result + "\""+relatedQueryTerms[i]+"\"";
			
			if(i != relatedQueryTerms.length-1)
			{
				result = result + " OR ";
			}
		}
		
		result = result + ")";
		try
		{
			result = URLEncoder.encode(result, "UTF-8");
		}catch (Exception e) {
			System.out.println("Error encoding URL");
		}
		return result;
	}
	
	private long getNumberOfPagesForQuery(String requiredTerm)
	{
		if(CONSUMER_KEY.equals("") || CONSUMER_SECRET.equals(""))
		{
			return 0;
		}
		String queryString = generateQuery(requiredTerm);
		
		MendeleyServiceFactory factory = MendeleyServiceFactory.newInstance(CONSUMER_KEY, CONSUMER_SECRET);
		SearchService service = factory.createSearchService();
		
		PagedList<Document> l = service.search(queryString,0,numberOfDocumentsPerRequest);
		
		return l.totalPages();
	}
	
	@Override
	long getTotalNumberOfQueryResults() {
		//always return 20 for now.
		return 20;
	}
	
	@Override
	SolrInputDocument[] searchForQuery() throws ParseException{
		if(CONSUMER_KEY.equals("") || CONSUMER_SECRET.equals(""))
		{
			return null;
		}
		System.out.println("Calling service on " + getSourceName());
		MendeleyServiceFactory factory = MendeleyServiceFactory.newInstance(CONSUMER_KEY, CONSUMER_SECRET);
		SearchService service = factory.createSearchService();
		
		List<SolrInputDocument> results = new ArrayList();
		String[] requiredTerms = getRequiredQueryTerms();
		for (int i = 0; i< requiredTerms.length; i++)
		{
			//long totalPages = getNumberOfPagesForQuery(requiredQueryTerms[i]);
			long totalPages = 1; /* There is a 500 requests per hour limit for document details request. So we take only top 20 docs */
			
			for(int j=0; j < totalPages; j++)
			{
				//parsing the query
				String queryString = generateQuery(requiredTerms[i]);
				try {
					queryString = URLEncoder.encode(queryString, "UTF-8");
				} catch (UnsupportedEncodingException e1) {
					// TODO Auto-generated catch block
					e1.printStackTrace();
				}
				PagedList<Document> documents = service.search(queryString,j,numberOfDocumentsPerRequest);
				
				if(documents.size() == 0)
				{
					return results.toArray(new SolrInputDocument[results.size()]);
				}
				
				for (int k=0; k<documents.size(); k++) 
				{
					//Document d = service.getDocumentDetails(document.getId());
					
					Document document = documents.get(k);
					
					SolrInputDocument d = new SolrInputDocument();
					
					if(document.getTitle() == null)
						continue;
					
					if(document.getMendeleyUrl() == null)
						continue;
					
					//setting title string by appending document tile and authors if any
					String authors = "";
					
					List<Person> authorsList= document.getAuthors();
					
					if(authorsList !=null && authorsList.size() != 0)
					{
						Iterator<Person> persons = authorsList.iterator();
						
						while(persons.hasNext())
						{
							authors += persons.next().toString() + ",";
						}
						
						//remove last comma
						authors.substring(0, authors.length()-2);
					}
					
					String title = document.getTitle();
					
					if(!authors.equals(""))
						title += " by " + authors;
					d.addField("title", title);
					
					d.addField("link", document.getMendeleyUrl());
					
					try{
						
						String docAbstract = service.getDocumentAbstractFromUUID(document.getUuid());
						if(docAbstract !=null)
							d.addField("description", docAbstract);
					}catch (MendeleyException e)
					{
						System.out.println("Error Querying Mendeley Service : " + e.getMessage());
						return null;
					}
					
					//setting date published to start of year of publication
					String yy ="";
					try{
						if(document.getYear() != 0)
						{
							yy = String.valueOf(document.getYear());
							String mm = "01";
							String dd = "01";
							DateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'");
							String pubDate = yy +"-"+ mm+"-"+dd+"T00:00:00Z";
							Date date_published = format.parse(pubDate); 
							
							d.addField("date_published", date_published);
						}
					}catch(Exception e){
						System.out.println("Exception parsing date in Medeley Data Source");
					}
					
					//setting date_added to current date
					Date date_added = new Date();
					d.addField("date_added", date_added);			
					d.addField("source", getSourceType());
					
					results.add(d);
				}
			}
			
		}
		return results.toArray(new SolrInputDocument[results.size()]);
	}
}
